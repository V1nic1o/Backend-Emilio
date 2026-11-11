import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemPedido, Pago, PagoProveedor, TipoPedido, TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { calcularResumenPedido, redondearMoneda } from '../comunes/utilidades/calculadora-pedido.util';
import { CrearPersonaDto } from './dto/crear-persona.dto';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto';
import { MENSAJES } from '../comunes/constantes/mensajes.constante';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';

type PedidoParaSaldoProveedor = {
  tipo: TipoPedido;
  personaId: number | null;
  proveedorId: number | null;
  esIntermediacion?: boolean | null;
  impuesto: number | null;
  items: ItemPedido[];
  pagos: Pago[];
  pagosProveedor: PagoProveedor[];
};

/**
 * Saldos vinculados a un contacto como `proveedorId` en pedidos:
 * - **Por pagar (costo)**: solo venta **cliente** con proveedor de costo (`esIntermediacion` falso, con `personaId`).
 *   No incluye intermediación: ahí `saldoProveedor` del resumen refleja costo ítems, no «lo que te debe el proveedor por margen».
 * - **Por cobrar (venta sin cliente)**: legado — venta con `personaId` null y sin intermediación explícita.
 * - **Por cobrar (intermediación)**: ventas con `esIntermediacion`; mismo criterio que el detalle del pedido: `saldoPendiente` del resumen (lado cobro al cliente / reparto según corresponda).
 */
function saldosVinculoProveedorPedidos(pedidos: PedidoParaSaldoProveedor[]) {
  let porPagarCosto = 0;
  let porCobrarVentasSinCliente = 0;
  let porCobrarClienteAProveedorInter = 0;
  for (const pedido of pedidos) {
    const r = calcularResumenPedido(
      pedido.items,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    const esLegadoVentaSinCliente =
      pedido.tipo === TipoPedido.venta &&
      (pedido.personaId == null || pedido.personaId === undefined) &&
      pedido.esIntermediacion !== true;

    if (esLegadoVentaSinCliente) {
      porCobrarVentasSinCliente += r.saldoPendiente;
      continue;
    }

    if (pedido.tipo === TipoPedido.venta && pedido.esIntermediacion === true) {
      porCobrarClienteAProveedorInter += redondearMoneda(r.saldoPendiente);
      continue;
    }

    if (
      pedido.tipo === TipoPedido.venta &&
      pedido.personaId != null &&
      pedido.esIntermediacion !== true
    ) {
      porPagarCosto += r.saldoProveedor;
      continue;
    }

    porPagarCosto += r.saldoProveedor;
  }
  return { porPagarCosto, porCobrarVentasSinCliente, porCobrarClienteAProveedorInter };
}

/**
 * Servicio de Personas.
 * Gestiona clientes y proveedores filtrados por wallet.
 */
@Injectable()
export class PersonasServicio {
  constructor(private readonly prisma: PrismaServicio) {}

  async crear(datos: CrearPersonaDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.empresa);
    return this.prisma.persona.create({
      data: {
        walletId: datos.walletId,
        nombre: datos.nombre,
        tipo: datos.tipo,
        nit: datos.nit?.trim() || null,
        direccion: datos.direccion ?? null,
        email: datos.email ?? null,
        telefono: datos.telefono ?? null,
      },
    });
  }

  /**
   * Lista personas de un wallet específico.
   * Para proveedores: costo pendiente (venta cliente + proveedor), legado «sin cliente», y por cobrar en intermediación.
   */
  async listar(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    const personas = await this.prisma.persona.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      include: {
        pedidosProveedor: {
          include: { items: true, pagosProveedor: true, pagos: true },
        },
      },
    });

    return personas.map((persona) => {
      const { porPagarCosto, porCobrarVentasSinCliente, porCobrarClienteAProveedorInter } = saldosVinculoProveedorPedidos(
        persona.pedidosProveedor,
      );
      const { pedidosProveedor, ...resto } = persona;
      return {
        ...resto,
        saldoCostoPendienteConProveedor: porPagarCosto,
        saldoVentaPorCobrarComoProveedor: porCobrarVentasSinCliente,
        saldoPorCobrarClienteAProveedor: porCobrarClienteAProveedorInter,
        pedidosProveedorCount: pedidosProveedor.length,
      };
    });
  }

  private async assertPersonaEmpresaUsuario(personaId: number, usuarioId: number) {
    const persona = await this.prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new NotFoundException(MENSAJES.PERSONA.NO_ENCONTRADA);
    }
    if (persona.walletId == null) {
      throw new BadRequestException('La persona no está asociada a un workspace.');
    }
    await assertWalletUsuarioYTipo(this.prisma, persona.walletId, usuarioId, TipoWallet.empresa);
  }

  async obtenerPorId(id: number, usuarioId: number) {
    const persona = await this.prisma.persona.findUnique({
      where: { id },
      include: {
        pedidos: {
          orderBy: { createdAt: 'desc' },
          include: { items: true, pagos: true },
        },
        pedidosProveedor: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            pagos: true,
            pagosProveedor: true,
            persona: true, // el cliente del pedido
          },
        },
      },
    });

    if (!persona) {
      throw new NotFoundException(MENSAJES.PERSONA.NO_ENCONTRADA);
    }
    if (persona.walletId == null) {
      throw new BadRequestException('La persona no está asociada a un workspace.');
    }
    await assertWalletUsuarioYTipo(this.prisma, persona.walletId, usuarioId, TipoWallet.empresa);

    const pedidosProveedorConResumen = persona.pedidosProveedor.map((pedido) => {
      const resumen = calcularResumenPedido(
        pedido.items,
        pedido.pagos,
        pedido.tipo,
        pedido.pagosProveedor,
        pedido.impuesto,
        pedido.personaId,
        pedido.proveedorId,
      );
      return { ...pedido, resumen };
    });

    const { porPagarCosto, porCobrarVentasSinCliente, porCobrarClienteAProveedorInter } =
      saldosVinculoProveedorPedidos(pedidosProveedorConResumen);

    return {
      ...persona,
      pedidosProveedor: pedidosProveedorConResumen,
      saldoCostoPendienteConProveedor: porPagarCosto,
      saldoVentaPorCobrarComoProveedor: porCobrarVentasSinCliente,
      saldoPorCobrarClienteAProveedor: porCobrarClienteAProveedorInter,
    };
  }

  async actualizar(id: number, datos: ActualizarPersonaDto, usuarioId: number) {
    await this.assertPersonaEmpresaUsuario(id, usuarioId);

    return this.prisma.persona.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined && { nombre: datos.nombre.trim() }),
        ...(datos.tipo !== undefined && { tipo: datos.tipo }),
        ...(datos.nit !== undefined && { nit: datos.nit.trim() || null }),
        ...(datos.direccion !== undefined && { direccion: datos.direccion.trim() || null }),
        ...(datos.email !== undefined && { email: datos.email.trim() || null }),
        ...(datos.telefono !== undefined && { telefono: datos.telefono.trim() || null }),
      },
    });
  }

  async eliminar(id: number, usuarioId: number) {
    await this.assertPersonaEmpresaUsuario(id, usuarioId);

    await this.prisma.persona.delete({ where: { id } });

    return { mensaje: 'Persona eliminada exitosamente' };
  }
}
