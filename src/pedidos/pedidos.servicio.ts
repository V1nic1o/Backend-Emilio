import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { ActualizarPedidoDto } from './dto/actualizar-pedido.dto';
import { CrearPagoDto } from './pagos/dto/crear-pago.dto';
import { CrearPagoProveedorDto } from './pagos/dto/crear-pago-proveedor.dto';
import { CrearItemDto } from './items/dto/crear-item.dto';
import { ActualizarItemDto } from './items/dto/actualizar-item.dto';
import {
  calcularResumenPedido,
  calcularTotalCompra,
  calcularTotalPagado,
  calcularTotalPagadoProveedor,
} from '../comunes/utilidades/calculadora-pedido.util';
import { modoPedidoNegocio } from '../comunes/utilidades/modo-pedido.util';
import { MENSAJES } from '../comunes/constantes/mensajes.constante';
import { wherePedidoPerteneceAWalletEmpresa } from '../comunes/utilidades/where-pedido-wallet.util';
import { ProductosServicio } from '../productos/productos.servicio';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';
import { TipoItem, TipoPagoProveedor, TipoPedido, TipoPersona, TipoWallet } from '@prisma/client';

const INCLUDE_PEDIDO_COMPLETO = {
  items: true,
  pagos: { orderBy: { fecha: 'desc' as const } },
  pagosProveedor: { orderBy: { fecha: 'desc' as const } },
  persona: true,
  proveedor: true,
} as const;

/**
 * Servicio de Pedidos.
 * Centraliza la lógica de pedidos, pagos (cliente y proveedor) y gestión de ítems.
 */
@Injectable()
export class PedidosServicio {
  private readonly logger = new Logger(PedidosServicio.name);

  constructor(
    private readonly prisma: PrismaServicio,
    private readonly productosServicio: ProductosServicio,
  ) {}

  /**
   * No debe fallar el pedido si el catálogo no se puede actualizar (red, DB, etc.).
   */
  private async sincronizarItemAlCatalogo(
    walletId: number,
    item: { nombre: string; tipo: TipoItem; precioCompra: number; precioVenta: number },
  ): Promise<void> {
    try {
      await this.productosServicio.sincronizarDesdeItemPedidoIfNotExists(walletId, item);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Catálogo: no se pudo sincronizar ítem «${item.nombre.trim()}»: ${mensaje}`);
    }
  }

  /** Comprueba que el pedido exista y pertenezca a un workspace de empresa del usuario. */
  private async assertPedidoEmpresaUsuario(pedidoId: number, usuarioId: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { persona: { select: { walletId: true } }, proveedor: { select: { walletId: true } } },
    });
    if (!pedido) {
      throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);
    }
    const walletId = pedido.persona?.walletId ?? pedido.proveedor?.walletId;
    if (walletId == null) {
      throw new BadRequestException('El pedido no está asociado a un workspace válido.');
    }
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
  }

  async crear(datos: CrearPedidoDto, usuarioId: number) {
    const { tipo, personaId, proveedorId } = datos;

    if (tipo === TipoPedido.compra) {
      throw new BadRequestException(
        'Las compras ya no están disponibles. Creá una venta cliente o una venta proveedor.',
      );
    }

    if (personaId == null && proveedorId == null) {
      throw new BadRequestException(
        'En venta: elegí un cliente o, si no tenés contacto con el cliente final, al menos el proveedor asociado (costo).',
      );
    }

    const personaPrincipal = personaId
      ? await this.prisma.persona.findUnique({
          where: { id: personaId },
          include: { wallet: true },
        })
      : null;

    const proveedorRow =
      proveedorId != null
        ? await this.prisma.persona.findUnique({
            where: { id: proveedorId },
            include: { wallet: true },
          })
        : null;

    if (personaPrincipal) {
      if (!personaPrincipal.walletId || !personaPrincipal.wallet) {
        throw new BadRequestException('El cliente del pedido no está asociado a un workspace válido.');
      }
      if (personaPrincipal.wallet.tipo !== TipoWallet.empresa) {
        throw new BadRequestException('Los pedidos solo se pueden crear en un workspace de empresa.');
      }
      if (personaPrincipal.tipo !== TipoPersona.cliente) {
        throw new BadRequestException('En una venta con cliente, la persona principal debe ser un cliente.');
      }
    }
    if (proveedorId != null) {
      if (!proveedorRow?.walletId || !proveedorRow.wallet) {
        throw new BadRequestException('El proveedor asociado no está en un workspace válido.');
      }
      if (proveedorRow.wallet.tipo !== TipoWallet.empresa) {
        throw new BadRequestException('Los pedidos solo se pueden crear en un workspace de empresa.');
      }
      if (proveedorRow.tipo !== TipoPersona.proveedor) {
        throw new BadRequestException('El proveedor asociado debe ser una persona tipo proveedor.');
      }
      if (personaPrincipal && proveedorRow.id === personaPrincipal.id) {
        throw new BadRequestException('El proveedor asociado no puede ser el mismo que el cliente.');
      }
      if (personaPrincipal && proveedorRow.walletId !== personaPrincipal.walletId) {
        throw new BadRequestException('Cliente y proveedor asociado deben pertenecer al mismo workspace.');
      }
    }
    if (!personaPrincipal && proveedorRow) {
      if (!proveedorRow.walletId || !proveedorRow.wallet) {
        throw new BadRequestException('El proveedor asociado no está en un workspace válido.');
      }
      if (proveedorRow.wallet.tipo !== TipoWallet.empresa) {
        throw new BadRequestException('Los pedidos solo se pueden crear en un workspace de empresa.');
      }
    }

    const w = personaPrincipal?.walletId ?? proveedorRow?.walletId;
    if (w == null) {
      throw new BadRequestException('No se pudo determinar el workspace del pedido.');
    }
    const walletIdNegocio = w;
    await assertWalletUsuarioYTipo(this.prisma, walletIdNegocio, usuarioId, TipoWallet.empresa);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          personaId: personaId ?? null,
          proveedorId: proveedorId ?? null,
          tipo: datos.tipo,
          nombreReferencia: datos.nombreReferencia?.trim() ? datos.nombreReferencia.trim() : null,
          impuesto:
            datos.impuesto != null && Number(datos.impuesto) > 0 ? Number(datos.impuesto) : null,
          esIntermediacion: datos.esIntermediacion ?? false,
          fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
          items: {
            create: datos.items.map((item) => ({
              productoId: item.productoId ?? null,
              tipo: item.tipo,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precioCompra: item.precioCompra,
              precioVenta: item.precioVenta,
            })),
          },
        },
        include: { items: true, pagos: true, pagosProveedor: true, persona: true, proveedor: true },
      });

      if (datos.pagoInicial) {
        const fechaIni = datos.pagoInicial.fecha ? new Date(datos.pagoInicial.fecha) : new Date();
        const montoIni = datos.pagoInicial.monto;

        const modoAlCrear = modoPedidoNegocio({
          tipo: TipoPedido.venta,
          esIntermediacion: datos.esIntermediacion ?? false,
          personaId: personaId ?? null,
          proveedorId: proveedorId ?? null,
        });

        /** Canal proveedor (venta proveedor o solo proveedor en app): pago inicial = trazabilidad cliente→proveedor. */
        if (modoAlCrear === 'venta_proveedor') {
          const resumenSinPagos = calcularResumenPedido(
            pedido.items,
            [],
            pedido.tipo,
            [],
            pedido.impuesto,
            pedido.personaId,
            pedido.proveedorId,
          );
          const topeIngresoClienteAlProveedor = resumenSinPagos.totalVenta;
          if (montoIni > topeIngresoClienteAlProveedor + 0.01) {
            throw new BadRequestException(
              `El monto no puede superar el total de venta del pedido (${topeIngresoClienteAlProveedor}).`,
            );
          }
          await tx.pagoProveedor.create({
            data: {
              pedidoId: pedido.id,
              monto: montoIni,
              fecha: fechaIni,
              tipo: TipoPagoProveedor.ingreso_cliente_a_proveedor,
            },
          });
        } else {
          await tx.pago.create({
            data: {
              pedidoId: pedido.id,
              monto: montoIni,
              fecha: fechaIni,
            },
          });
        }
      }

      const pedidoCompleto = await tx.pedido.findUnique({
        where: { id: pedido.id },
        include: INCLUDE_PEDIDO_COMPLETO,
      });

      const resumen = calcularResumenPedido(
        pedidoCompleto!.items,
        pedidoCompleto!.pagos,
        pedidoCompleto!.tipo,
        pedidoCompleto!.pagosProveedor,
        pedidoCompleto!.impuesto,
        pedidoCompleto!.personaId,
        pedidoCompleto!.proveedorId,
      );

      return { ...pedidoCompleto, resumen };
    });

    const walletId = resultado.persona?.walletId ?? resultado.proveedor?.walletId;
    if (walletId && Array.isArray(datos.items) && datos.items.length > 0) {
      for (const item of datos.items) {
        if (item.guardarEnCatalogo !== true) continue;
        await this.sincronizarItemAlCatalogo(walletId, {
          nombre: item.nombre,
          tipo: item.tipo,
          precioCompra: item.precioCompra,
          precioVenta: item.precioVenta,
        });
      }
    }

    return resultado;
  }

  async listar(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    const pedidos = await this.prisma.pedido.findMany({
      where: wherePedidoPerteneceAWalletEmpresa(walletId),
      include: {
        items: true,
        pagos: true,
        pagosProveedor: true,
        persona: true,
        proveedor: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return pedidos.map((pedido) => {
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
  }

  async obtenerDetalle(id: number, usuarioId: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: INCLUDE_PEDIDO_COMPLETO,
    });

    if (!pedido) {
      throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);
    }
    const walletId = pedido.persona?.walletId ?? pedido.proveedor?.walletId;
    if (walletId == null) {
      throw new BadRequestException('El pedido no está asociado a un workspace válido.');
    }
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);

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
  }

  /**
   * Actualiza nombre/referencia visible, impuesto (%) y cliente/proveedor principal.
   * No modifica ítems ni pagos.
   */
  async actualizar(id: number, datos: ActualizarPedidoDto, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(id, usuarioId);

    const pedidoActual = await this.prisma.pedido.findUnique({
      where: { id },
      include: { persona: true, proveedor: true },
    });

    if (!pedidoActual) {
      throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);
    }

    const data: { nombreReferencia?: string | null; impuesto?: number | null; personaId?: number | null } = {};

    if (datos.nombreReferencia !== undefined) {
      const t =
        datos.nombreReferencia === null || typeof datos.nombreReferencia !== 'string'
          ? ''
          : datos.nombreReferencia.trim();
      data.nombreReferencia = t.length > 0 ? t : null;
    }
    if (datos.impuesto !== undefined) {
      data.impuesto =
        datos.impuesto === null || datos.impuesto <= 0 ? null : datos.impuesto;
    }

    // Actualización de personaId (cliente o proveedor principal)
    if (datos.personaId !== undefined) {
      if (datos.personaId === null) {
        // Permitir quitar la persona solo en ventas con proveedor asociado
        if (pedidoActual.tipo === TipoPedido.venta && pedidoActual.proveedorId) {
          data.personaId = null;
        } else {
          throw new BadRequestException(
            'No se puede quitar el cliente/proveedor principal a menos que sea una venta con proveedor asociado.',
          );
        }
      } else {
        // Validar la nueva persona
        const nuevaPersona = await this.prisma.persona.findUnique({
          where: { id: datos.personaId },
          include: { wallet: true },
        });

        if (!nuevaPersona) {
          throw new NotFoundException('La persona seleccionada no existe.');
        }

        const walletIdPedido = pedidoActual.persona?.walletId ?? pedidoActual.proveedor?.walletId;
        if (nuevaPersona.walletId !== walletIdPedido) {
          throw new BadRequestException(
            'La persona debe pertenecer al mismo workspace del pedido.',
          );
        }

        // Validar tipo según el pedido
        if (pedidoActual.tipo === TipoPedido.compra) {
          if (nuevaPersona.tipo !== TipoPersona.proveedor) {
            throw new BadRequestException(
              'En una compra, la persona principal debe ser un proveedor.',
            );
          }
        } else {
          // venta
          if (nuevaPersona.tipo !== TipoPersona.cliente) {
            throw new BadRequestException(
              'En una venta, la persona principal debe ser un cliente.',
            );
          }
          // Si hay proveedor asociado, verificar que no sea la misma persona
          if (pedidoActual.proveedorId && pedidoActual.proveedorId === datos.personaId) {
            throw new BadRequestException(
              'El cliente no puede ser la misma persona que el proveedor asociado.',
            );
          }
        }

        data.personaId = datos.personaId;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.obtenerDetalle(id, usuarioId);
    }

    await this.prisma.pedido.update({
      where: { id },
      data,
    });
    return this.obtenerDetalle(id, usuarioId);
  }

  // ─── Pagos del cliente ────────────────────────────────────────────────────

  async registrarPago(pedidoId: number, datos: CrearPagoDto, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { items: true, pagos: true, pagosProveedor: true },
      });

      if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

      const resumenActual = calcularResumenPedido(
        pedido.items,
        pedido.pagos,
        pedido.tipo,
        pedido.pagosProveedor,
        pedido.impuesto,
        pedido.personaId,
        pedido.proveedorId,
      );

      if (resumenActual.estado === 'pagado') {
        throw new BadRequestException('Este pedido ya está completamente pagado por el cliente.');
      }
      // Tolerancia de 0.01 para evitar rechazos por errores de precisión float
      if (datos.monto > resumenActual.saldoPendiente + 0.01) {
        throw new BadRequestException(
          `El monto (${datos.monto}) supera el saldo pendiente del cliente (${resumenActual.saldoPendiente}).`,
        );
      }

      const nuevoPago = await tx.pago.create({
        data: { pedidoId, monto: datos.monto, fecha: datos.fecha ? new Date(datos.fecha) : new Date() },
      });

      const resumen = calcularResumenPedido(
        pedido.items,
        [...pedido.pagos, nuevoPago],
        pedido.tipo,
        pedido.pagosProveedor,
        pedido.impuesto,
        pedido.personaId,
        pedido.proveedorId,
      );
      return { pago: nuevoPago, resumen };
    });
  }

  // ─── Eliminar pago del cliente ────────────────────────────────────────────

  async eliminarPago(pedidoId: number, pagoId: number, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    const pago = await this.prisma.pago.findFirst({ where: { id: pagoId, pedidoId } });
    if (!pago) throw new NotFoundException('Pago no encontrado en este pedido');

    await this.prisma.pago.delete({ where: { id: pagoId } });

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: true, pagos: true, pagosProveedor: true },
    });
    if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

    const resumen = calcularResumenPedido(
      pedido.items,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    return { mensaje: 'Pago eliminado', resumen };
  }

  // ─── Eliminar pago al proveedor ───────────────────────────────────────────

  async eliminarPagoProveedor(pedidoId: number, pagoId: number, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    const pago = await this.prisma.pagoProveedor.findFirst({ where: { id: pagoId, pedidoId } });
    if (!pago) throw new NotFoundException('Pago al proveedor no encontrado en este pedido');

    await this.prisma.pagoProveedor.delete({ where: { id: pagoId } });

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: true, pagos: true, pagosProveedor: true },
    });
    if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

    const resumen = calcularResumenPedido(
      pedido.items,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    return { mensaje: 'Pago al proveedor eliminado', resumen };
  }

  // ─── Pagos al proveedor ───────────────────────────────────────────────────

  async registrarPagoProveedor(
    pedidoId: number,
    datos: CrearPagoProveedorDto,
    usuarioId: number,
  ) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { items: true, pagos: true, pagosProveedor: true },
      });

      if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

      if (!pedido.proveedorId) {
        throw new BadRequestException(
          'Este pedido no tiene un proveedor asociado. Editá el pedido para asignar uno.',
        );
      }

      const resumenActual = calcularResumenPedido(
        pedido.items,
        pedido.pagos,
        pedido.tipo,
        pedido.pagosProveedor,
        pedido.impuesto,
        pedido.personaId,
        pedido.proveedorId,
      );

      const tipoRaw = datos.tipo ?? 'pago';
      let tipo: TipoPagoProveedor = TipoPagoProveedor.pago;
      if (tipoRaw === 'cobro') tipo = TipoPagoProveedor.cobro;
      else if (tipoRaw === 'ingreso_cliente_a_proveedor') tipo = TipoPagoProveedor.ingreso_cliente_a_proveedor;

      if (tipo === TipoPagoProveedor.ingreso_cliente_a_proveedor) {
        const modo = modoPedidoNegocio(pedido);
        if (modo !== 'venta_proveedor') {
          throw new BadRequestException(
            'Solo se puede registrar ingreso de clientes al proveedor en venta proveedor (canal proveedor).',
          );
        }
        const totalVentaPedido = resumenActual.totalVenta ?? 0;
        const yaRegistradoIngresos = pedido.pagosProveedor
          .filter((p) => p.tipo === TipoPagoProveedor.ingreso_cliente_a_proveedor)
          .reduce((acc, p) => acc + p.monto, 0);
        const topeRestante = Math.max(0, totalVentaPedido - yaRegistradoIngresos);
        if (datos.monto > topeRestante + 0.01) {
          throw new BadRequestException(
            `El monto supera lo que podés registrar: los pagos de clientes al proveedor no pueden sumar más que el total de venta del pedido (${totalVentaPedido}). Ya registrado: ${yaRegistradoIngresos}. Máximo este movimiento: ${topeRestante}.`,
          );
        }
      }

      if (tipo === TipoPagoProveedor.pago) {
        if (resumenActual.estadoProveedor === 'pagado') {
          throw new BadRequestException('Ya no hay saldo pendiente para registrar un pago al proveedor.');
        }
        if (datos.monto > resumenActual.saldoProveedor + 0.01) {
          throw new BadRequestException(
            `El monto (${datos.monto}) supera el saldo pendiente al proveedor (${resumenActual.saldoProveedor}).`,
          );
        }
      }

      const nuevoPago = await tx.pagoProveedor.create({
        data: {
          pedidoId,
          monto: datos.monto,
          fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
          tipo,
        },
      });

      const resumen = calcularResumenPedido(
        pedido.items,
        pedido.pagos,
        pedido.tipo,
        [...pedido.pagosProveedor, nuevoPago],
        pedido.impuesto,
        pedido.personaId,
        pedido.proveedorId,
      );
      return { pago: nuevoPago, resumen };
    });
  }

  // ─── Eliminación ──────────────────────────────────────────────────────────

  async eliminar(id: number, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(id, usuarioId);

    await this.prisma.pedido.delete({ where: { id } });
    return { mensaje: MENSAJES.PEDIDO.ELIMINADO };
  }

  // ─── Gestión de ítems individuales ────────────────────────────────────────

  async agregarItem(pedidoId: number, datos: CrearItemDto, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        items: true,
        pagos: true,
        pagosProveedor: true,
        persona: { select: { walletId: true } },
        proveedor: { select: { walletId: true } },
      },
    });

    if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

    const nuevoItem = await this.prisma.itemPedido.create({
      data: {
        pedidoId,
        productoId: datos.productoId ?? null,
        tipo: datos.tipo,
        nombre: datos.nombre,
        cantidad: datos.cantidad,
        precioCompra: datos.precioCompra,
        precioVenta: datos.precioVenta,
      },
    });

    const walletId = pedido.persona?.walletId ?? pedido.proveedor?.walletId;
    if (walletId && datos.guardarEnCatalogo === true) {
      await this.sincronizarItemAlCatalogo(walletId, {
        nombre: datos.nombre,
        tipo: datos.tipo,
        precioCompra: datos.precioCompra,
        precioVenta: datos.precioVenta,
      });
    }

    const resumen = calcularResumenPedido(
      [...pedido.items, nuevoItem],
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    return { item: nuevoItem, resumen };
  }

  async actualizarItem(
    pedidoId: number,
    itemId: number,
    datos: ActualizarItemDto,
    usuarioId: number,
  ) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: true, pagos: true, pagosProveedor: true },
    });

    if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

    const itemExistente = pedido.items.find((i) => i.id === itemId);
    if (!itemExistente) throw new NotFoundException('Ítem no encontrado en este pedido');

    const itemActualizado = await this.prisma.itemPedido.update({
      where: { id: itemId },
      data: {
        ...(datos.tipo !== undefined && { tipo: datos.tipo }),
        ...(datos.nombre !== undefined && { nombre: datos.nombre }),
        ...(datos.cantidad !== undefined && { cantidad: datos.cantidad }),
        ...(datos.precioCompra !== undefined && { precioCompra: datos.precioCompra }),
        ...(datos.precioVenta !== undefined && { precioVenta: datos.precioVenta }),
      },
    });

    const itemsActualizados = pedido.items.map((i) => (i.id === itemId ? { ...i, ...itemActualizado } : i));
    const resumen = calcularResumenPedido(
      itemsActualizados,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    return { item: itemActualizado, resumen };
  }

  async eliminarItem(pedidoId: number, itemId: number, usuarioId: number) {
    await this.assertPedidoEmpresaUsuario(pedidoId, usuarioId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: true, pagos: true, pagosProveedor: true },
    });

    if (!pedido) throw new NotFoundException(MENSAJES.PEDIDO.NO_ENCONTRADO);

    const itemExistente = pedido.items.find((i) => i.id === itemId);
    if (!itemExistente) throw new NotFoundException('Ítem no encontrado en este pedido');

    if (pedido.items.length <= 1) {
      throw new BadRequestException(
        'No se puede eliminar el único ítem del pedido. Eliminá el pedido completo si ya no es necesario.',
      );
    }

    const itemsRestantes = pedido.items.filter((i) => i.id !== itemId);
    const resumenSiSeElimina = calcularResumenPedido(
      itemsRestantes,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    const topeCliente = resumenSiSeElimina.referenciaSaldoCliente;
    const totalPagado = calcularTotalPagado(pedido.pagos);
    const totalPagadoProveedor = calcularTotalPagadoProveedor(pedido.pagosProveedor);
    const nuevoTotalCompra = calcularTotalCompra(itemsRestantes);

    if (totalPagado > topeCliente + 0.01) {
      throw new BadRequestException(
        `No se puede eliminar este ítem: los pagos del cliente (Q${totalPagado.toFixed(2)}) superarían el nuevo total a cobrar (Q${topeCliente.toFixed(2)}).`,
      );
    }
    if (totalPagadoProveedor > nuevoTotalCompra + 0.01) {
      throw new BadRequestException(
        `No se puede eliminar este ítem: los pagos al proveedor (Q${totalPagadoProveedor.toFixed(2)}) superarían el nuevo costo del pedido (Q${nuevoTotalCompra.toFixed(2)}).`,
      );
    }

    await this.prisma.itemPedido.delete({ where: { id: itemId } });

    const resumen = calcularResumenPedido(
      itemsRestantes,
      pedido.pagos,
      pedido.tipo,
      pedido.pagosProveedor,
      pedido.impuesto,
      pedido.personaId,
      pedido.proveedorId,
    );
    return { mensaje: 'Ítem eliminado exitosamente', resumen };
  }
}
