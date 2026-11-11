import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { assertWalletUsuario } from '../wallets/wallet-aut.util';
import { TipoWallet } from '@prisma/client';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { ActualizarGastoDto } from './dto/actualizar-gasto.dto';
import { CrearCategoriaGastoDto } from './dto/crear-categoria-gasto.dto';
import { MENSAJES } from '../comunes/constantes/mensajes.constante';

/**
 * Servicio de Gastos.
 * Gestiona los egresos filtrados por wallet.
 */
@Injectable()
export class GastosServicio {
  constructor(private readonly prisma: PrismaServicio) {}

  private async resolverPresupuestoGasto(
    walletId: number,
    presupuestoPersonalId: number | null | undefined,
    fecha: Date,
    usuarioId: number,
  ): Promise<number | null> {
    if (presupuestoPersonalId == null || presupuestoPersonalId === undefined) return null;
    const p = await this.prisma.presupuestoPersonal.findUnique({
      where: { id: presupuestoPersonalId },
      include: { wallet: true },
    });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    if (p.walletId !== walletId || p.wallet.usuarioId !== usuarioId) {
      throw new BadRequestException('Presupuesto no válido para este workspace');
    }
    if (p.wallet.tipo !== TipoWallet.personal) {
      throw new BadRequestException('Los presupuestos por rubro solo aplican en workspace personal');
    }
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    if (p.anio !== anio || p.mes !== mes) {
      throw new BadRequestException(
        'El presupuesto elegido no corresponde al mes de la fecha del gasto',
      );
    }
    return presupuestoPersonalId;
  }

  private mapGasto(g: {
    id: number;
    walletId: number | null;
    descripcion: string;
    monto: number;
    fecha: Date;
    categoria: string | null;
    presupuestoPersonalId: number | null;
    presupuestoPersonal?: { id: number; nombre: string } | null;
  }) {
    return {
      id: g.id,
      walletId: g.walletId ?? undefined,
      descripcion: g.descripcion,
      monto: g.monto,
      fecha: g.fecha,
      categoria: g.categoria ?? undefined,
      presupuestoPersonalId: g.presupuestoPersonalId ?? undefined,
      presupuestoNombre: g.presupuestoPersonal?.nombre ?? undefined,
    };
  }

  async crear(datos: CrearGastoDto, usuarioId: number) {
    await assertWalletUsuario(this.prisma, datos.walletId, usuarioId);
    const categoria = datos.categoria?.trim() || null;
    if (categoria) {
      await this.asegurarCategoriaGuardada(datos.walletId, categoria);
    }
    const fecha = datos.fecha ? new Date(datos.fecha) : new Date();
    const presupuestoPersonalId = await this.resolverPresupuestoGasto(
      datos.walletId,
      datos.presupuestoPersonalId,
      fecha,
      usuarioId,
    );
    const creado = await this.prisma.gasto.create({
      data: {
        walletId: datos.walletId,
        descripcion: datos.descripcion,
        monto: datos.monto,
        fecha,
        categoria,
        presupuestoPersonalId,
      },
      include: { presupuestoPersonal: { select: { id: true, nombre: true } } },
    });
    return this.mapGasto(creado);
  }

  /**
   * Lista gastos de un wallet (empresa o personal).
   */
  async listar(walletId: number, usuarioId: number) {
    await assertWalletUsuario(this.prisma, walletId, usuarioId);
    const rows = await this.prisma.gasto.findMany({
      where: { walletId },
      orderBy: { fecha: 'desc' },
      include: { presupuestoPersonal: { select: { id: true, nombre: true } } },
    });
    return rows.map((g) => this.mapGasto(g));
  }

  async actualizar(id: number, datos: ActualizarGastoDto, usuarioId: number) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });

    if (!gasto) {
      throw new NotFoundException(MENSAJES.GASTO.NO_ENCONTRADO);
    }
    if (gasto.walletId == null) {
      throw new BadRequestException('El gasto no está asociado a un workspace.');
    }
    await assertWalletUsuario(this.prisma, gasto.walletId, usuarioId);

    const data: {
      descripcion?: string;
      monto?: number;
      fecha?: Date;
      categoria?: string | null;
      presupuestoPersonalId?: number | null;
    } = {};
    if (datos.descripcion !== undefined) data.descripcion = datos.descripcion.trim();
    if (datos.monto !== undefined) data.monto = datos.monto;
    if (datos.fecha !== undefined) data.fecha = new Date(datos.fecha);
    if (datos.categoria !== undefined) {
      data.categoria = datos.categoria === null || datos.categoria === '' ? null : datos.categoria.trim();
      if (data.categoria) {
        await this.asegurarCategoriaGuardada(gasto.walletId, data.categoria);
      }
    }

    const fechaFinal = data.fecha ?? gasto.fecha;
    if (datos.presupuestoPersonalId !== undefined) {
      if (datos.presupuestoPersonalId === null) {
        data.presupuestoPersonalId = null;
      } else {
        data.presupuestoPersonalId = await this.resolverPresupuestoGasto(
          gasto.walletId,
          datos.presupuestoPersonalId,
          fechaFinal,
          usuarioId,
        );
      }
    } else if (data.fecha != null && gasto.presupuestoPersonalId != null) {
      await this.resolverPresupuestoGasto(
        gasto.walletId,
        gasto.presupuestoPersonalId,
        fechaFinal,
        usuarioId,
      );
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Enviá al menos un campo para actualizar');
    }

    const act = await this.prisma.gasto.update({
      where: { id },
      data,
      include: { presupuestoPersonal: { select: { id: true, nombre: true } } },
    });
    return this.mapGasto(act);
  }

  async eliminar(id: number, usuarioId: number) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });

    if (!gasto) {
      throw new NotFoundException(MENSAJES.GASTO.NO_ENCONTRADO);
    }
    if (gasto.walletId == null) {
      throw new BadRequestException('El gasto no está asociado a un workspace.');
    }
    await assertWalletUsuario(this.prisma, gasto.walletId, usuarioId);

    await this.prisma.gasto.delete({ where: { id } });

    return { mensaje: MENSAJES.GASTO.ELIMINADO };
  }

  /** Lista categorías personalizadas guardadas en un wallet. */
  async listarCategorias(walletId: number, usuarioId: number) {
    await assertWalletUsuario(this.prisma, walletId, usuarioId);

    const distinctFromGastos = await this.prisma.gasto.findMany({
      where: { walletId, categoria: { not: null } },
      select: { categoria: true },
      distinct: ['categoria'],
    });
    for (const g of distinctFromGastos) {
      if (g.categoria) {
        await this.asegurarCategoriaGuardada(walletId, g.categoria);
      }
    }

    return this.prisma.categoriaGasto.findMany({
      where: { walletId },
      orderBy: { nombre: 'asc' },
    });
  }

  /** Crea una categoría personalizada reutilizable (idempotente si ya existe). */
  async crearCategoria(datos: CrearCategoriaGastoDto, usuarioId: number) {
    await assertWalletUsuario(this.prisma, datos.walletId, usuarioId);
    const nombre = datos.nombre.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre de la categoría es obligatorio');
    }

    const existente = await this.prisma.categoriaGasto.findFirst({
      where: {
        walletId: datos.walletId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
    });
    if (existente) {
      return existente;
    }

    try {
      return await this.prisma.categoriaGasto.create({
        data: { walletId: datos.walletId, nombre },
      });
    } catch {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
  }

  /** Persiste el nombre de categoría para reutilizarlo en futuros gastos del wallet. */
  private async asegurarCategoriaGuardada(walletId: number, nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) return;

    const existente = await this.prisma.categoriaGasto.findFirst({
      where: {
        walletId,
        nombre: { equals: limpio, mode: 'insensitive' },
      },
    });
    if (existente) return;

    await this.prisma.categoriaGasto.create({
      data: { walletId, nombre: limpio },
    }).catch(() => {
      // Carrera concurrente u otra petición: ignorar si ya existe.
    });
  }
}
