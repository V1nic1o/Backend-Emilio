import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';
import { TipoWallet } from '@prisma/client';
import { CrearIngresoPersonalDto } from './dto/crear-ingreso.dto';
import { ActualizarIngresoPersonalDto } from './dto/actualizar-ingreso.dto';
import { CrearDeudaPersonalDto } from './dto/crear-deuda.dto';
import { ActualizarDeudaPersonalDto } from './dto/actualizar-deuda.dto';
import { CrearAhorroPersonalDto } from './dto/crear-ahorro.dto';
import { ActualizarAhorroPersonalDto } from './dto/actualizar-ahorro.dto';
import { CrearPresupuestoRubroDto } from './dto/crear-presupuesto-rubro.dto';
import { ActualizarPresupuestoRubroDto } from './dto/actualizar-presupuesto-rubro.dto';
import { CopiarPresupuestosDto } from './dto/copiar-presupuestos.dto';

function inicioFinMes(ahora: Date): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
}

function finFinMes(ahora: Date): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
}

function anioMesDesdeFecha(f: Date): { anio: number; mes: number } {
  return { anio: f.getFullYear(), mes: f.getMonth() + 1 };
}

function enriquecerRubroPresupuesto(
  rubro: { id: number; walletId: number; anio: number; mes: number; nombre: string; montoLimite: number; createdAt: Date; updatedAt: Date },
  totalGastado: number,
) {
  const montoLimite = rubro.montoLimite;
  const gastosVsPresupuestoPct =
    montoLimite > 0 ? Math.round((totalGastado / montoLimite) * 100) : null;
  const disponible = Math.round((montoLimite - totalGastado) * 100) / 100;
  return {
    ...rubro,
    totalGastado,
    gastosVsPresupuestoPct,
    presupuestoExcedido: montoLimite > 0 && totalGastado > montoLimite,
    disponible,
  };
}

function rangoMesCalendario(anio: number, mes: number): { desde: Date; hasta: Date } {
  const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);
  return { desde, hasta };
}

@Injectable()
export class FinanzasPersonalesServicio {
  constructor(private readonly prisma: PrismaServicio) {}

  private async gastadoRubroEnMes(presupuestoId: number, anio: number, mes: number): Promise<number> {
    const { desde, hasta } = rangoMesCalendario(anio, mes);
    const agg = await this.prisma.gasto.aggregate({
      where: {
        presupuestoPersonalId: presupuestoId,
        fecha: { gte: desde, lte: hasta },
      },
      _sum: { monto: true },
    });
    return agg._sum.monto ?? 0;
  }

  private async listarRubrosEnriquecidos(walletId: number, anio: number, mes: number) {
    const rubros = await this.prisma.presupuestoPersonal.findMany({
      where: { walletId, anio, mes },
      orderBy: { nombre: 'asc' },
    });
    const out = [];
    for (const r of rubros) {
      const totalGastado = await this.gastadoRubroEnMes(r.id, anio, mes);
      out.push(enriquecerRubroPresupuesto(r, totalGastado));
    }
    return out;
  }

  async resumen(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.personal);
    const ahora = new Date();
    const desde = inicioFinMes(ahora);
    const hasta = finFinMes(ahora);

    const [ingresosMes, gastosMes, deudas, ahorros, presupuestosRubros] = await Promise.all([
      this.prisma.ingresoPersonal.aggregate({
        where: { walletId, fecha: { gte: desde, lte: hasta } },
        _sum: { monto: true },
      }),
      this.prisma.gasto.aggregate({
        where: { walletId, fecha: { gte: desde, lte: hasta } },
        _sum: { monto: true },
      }),
      this.prisma.deudaPersonal.findMany({ where: { walletId } }),
      this.prisma.ahorroPersonal.findMany({ where: { walletId } }),
      this.listarRubrosEnriquecidos(walletId, ahora.getFullYear(), ahora.getMonth() + 1),
    ]);

    const pendienteDeudas = deudas.reduce(
      (acc, d) => acc + Math.max(0, d.montoOriginal - d.montoPagado),
      0,
    );
    const totalAhorrado = ahorros.reduce((acc, a) => acc + a.montoActual, 0);
    const totalGastosMes = gastosMes._sum.monto ?? 0;

    return {
      totalIngresosMes: ingresosMes._sum.monto ?? 0,
      totalGastosMes,
      balanceMes: (ingresosMes._sum.monto ?? 0) - totalGastosMes,
      deudasPendientesTotal: pendienteDeudas,
      cantidadDeudas: deudas.length,
      totalAhorrado,
      cantidadMetasAhorro: ahorros.length,
      presupuestosRubros,
    };
  }

  async listarPresupuestosMes(walletId: number, usuarioId: number, anio: number, mes: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.personal);
    if (mes < 1 || mes > 12) throw new BadRequestException('Mes inválido');
    return this.listarRubrosEnriquecidos(walletId, anio, mes);
  }

  async crearPresupuestoRubro(datos: CrearPresupuestoRubroDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.personal);
    const nombre = datos.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre del rubro es obligatorio');
    try {
      const creado = await this.prisma.presupuestoPersonal.create({
        data: {
          walletId: datos.walletId,
          anio: datos.anio,
          mes: datos.mes,
          nombre,
          montoLimite: datos.montoLimite,
        },
      });
      return enriquecerRubroPresupuesto(creado, 0);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        throw new ConflictException('Ya existe un presupuesto con ese nombre en este mes');
      }
      throw e;
    }
  }

  async actualizarPresupuestoRubro(id: number, datos: ActualizarPresupuestoRubroDto, usuarioId: number) {
    const row = await this.prisma.presupuestoPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Presupuesto no encontrado');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    const data: { nombre?: string; montoLimite?: number } = {};
    if (datos.nombre !== undefined) {
      const nombre = datos.nombre.trim();
      if (!nombre) throw new BadRequestException('El nombre no puede estar vacío');
      data.nombre = nombre;
    }
    if (datos.montoLimite !== undefined) data.montoLimite = datos.montoLimite;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Enviá al menos un campo para actualizar');
    }
    try {
      const act = await this.prisma.presupuestoPersonal.update({ where: { id }, data });
      const totalGastado = await this.gastadoRubroEnMes(act.id, act.anio, act.mes);
      return enriquecerRubroPresupuesto(act, totalGastado);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        throw new ConflictException('Ya existe un presupuesto con ese nombre en este mes');
      }
      throw e;
    }
  }

  async eliminarPresupuestoRubro(id: number, usuarioId: number) {
    const row = await this.prisma.presupuestoPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Presupuesto no encontrado');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    await this.prisma.presupuestoPersonal.delete({ where: { id } });
    return { mensaje: 'Presupuesto eliminado' };
  }

  async copiarPresupuestosMes(datos: CopiarPresupuestosDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.personal);
    const origen = await this.prisma.presupuestoPersonal.findMany({
      where: {
        walletId: datos.walletId,
        anio: datos.anioOrigen,
        mes: datos.mesOrigen,
      },
    });
    if (origen.length === 0) {
      throw new BadRequestException('No hay presupuestos en el mes de origen para copiar');
    }
    const existentesDestino = await this.prisma.presupuestoPersonal.findMany({
      where: {
        walletId: datos.walletId,
        anio: datos.anioDestino,
        mes: datos.mesDestino,
      },
      select: { nombre: true },
    });
    const nombresDestino = new Set(existentesDestino.map((r) => r.nombre.toLowerCase()));
    let copiados = 0;
    for (const r of origen) {
      if (nombresDestino.has(r.nombre.toLowerCase())) continue;
      await this.prisma.presupuestoPersonal.create({
        data: {
          walletId: datos.walletId,
          anio: datos.anioDestino,
          mes: datos.mesDestino,
          nombre: r.nombre,
          montoLimite: r.montoLimite,
        },
      });
      copiados += 1;
    }
    return {
      copiados,
      omitidos: origen.length - copiados,
      rubros: await this.listarRubrosEnriquecidos(datos.walletId, datos.anioDestino, datos.mesDestino),
    };
  }

  /** Valida vínculo gasto ↔ rubro (mismo wallet y mes calendario de la fecha del gasto). */
  async validarPresupuestoParaGasto(
    walletId: number,
    presupuestoId: number | null | undefined,
    fecha: Date,
    usuarioId: number,
  ): Promise<number | null> {
    if (presupuestoId == null) return null;
    const row = await this.prisma.presupuestoPersonal.findUnique({
      where: { id: presupuestoId },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Presupuesto no encontrado');
    if (row.walletId !== walletId || row.wallet.usuarioId !== usuarioId) {
      throw new ForbiddenException('Sin permiso sobre este presupuesto');
    }
    if (row.wallet.tipo !== TipoWallet.personal) {
      throw new BadRequestException('Los presupuestos por rubro solo aplican en workspace personal');
    }
    const { anio, mes } = anioMesDesdeFecha(fecha);
    if (row.anio !== anio || row.mes !== mes) {
      throw new BadRequestException(
        'El presupuesto elegido no corresponde al mes de la fecha del gasto',
      );
    }
    return presupuestoId;
  }

  // ─── Ingresos ───────────────────────────────────────────────────────────

  async listarIngresos(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.personal);
    return this.prisma.ingresoPersonal.findMany({
      where: { walletId },
      orderBy: { fecha: 'desc' },
    });
  }

  async crearIngreso(datos: CrearIngresoPersonalDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.personal);
    return this.prisma.ingresoPersonal.create({
      data: {
        walletId: datos.walletId,
        descripcion: datos.descripcion.trim(),
        monto: datos.monto,
        fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
      },
    });
  }

  async actualizarIngreso(id: number, datos: ActualizarIngresoPersonalDto, usuarioId: number) {
    const row = await this.prisma.ingresoPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Ingreso no encontrado');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    const data: {
      descripcion?: string;
      monto?: number;
      fecha?: Date;
    } = {};
    if (datos.descripcion !== undefined) data.descripcion = datos.descripcion.trim();
    if (datos.monto !== undefined) data.monto = datos.monto;
    if (datos.fecha !== undefined) data.fecha = new Date(datos.fecha);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Enviá al menos un campo para actualizar');
    }
    return this.prisma.ingresoPersonal.update({ where: { id }, data });
  }

  async eliminarIngreso(id: number, usuarioId: number) {
    const row = await this.prisma.ingresoPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Ingreso no encontrado');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    await this.prisma.ingresoPersonal.delete({ where: { id } });
    return { mensaje: 'Ingreso eliminado' };
  }

  // ─── Deudas ─────────────────────────────────────────────────────────────

  async listarDeudas(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.personal);
    return this.prisma.deudaPersonal.findMany({
      where: { walletId },
      orderBy: { fecha: 'desc' },
    });
  }

  async crearDeuda(datos: CrearDeudaPersonalDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.personal);
    return this.prisma.deudaPersonal.create({
      data: {
        walletId: datos.walletId,
        titulo: datos.titulo.trim(),
        montoOriginal: datos.montoOriginal,
        montoPagado: 0,
        fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
        notas: datos.notas?.trim() || null,
      },
    });
  }

  async actualizarDeuda(id: number, datos: ActualizarDeudaPersonalDto, usuarioId: number) {
    const row = await this.prisma.deudaPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Deuda no encontrada');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }

    let montoOriginal = row.montoOriginal;
    let montoPagado = row.montoPagado;

    if (datos.montoOriginal !== undefined) {
      if (datos.montoOriginal < 0) {
        throw new BadRequestException('El monto original no puede ser negativo');
      }
      montoOriginal = datos.montoOriginal;
      montoPagado = Math.min(montoPagado, montoOriginal);
    }

    if (datos.montoPagado !== undefined) {
      montoPagado = Math.min(datos.montoPagado, montoOriginal);
    }

    return this.prisma.deudaPersonal.update({
      where: { id },
      data: {
        ...(datos.titulo !== undefined && { titulo: datos.titulo.trim() }),
        montoOriginal,
        montoPagado,
        ...(datos.fecha !== undefined && { fecha: new Date(datos.fecha) }),
        ...(datos.notas !== undefined && { notas: datos.notas.trim() || null }),
      },
    });
  }

  async eliminarDeuda(id: number, usuarioId: number) {
    const row = await this.prisma.deudaPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Deuda no encontrada');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    await this.prisma.deudaPersonal.delete({ where: { id } });
    return { mensaje: 'Deuda eliminada' };
  }

  // ─── Ahorros ──────────────────────────────────────────────────────────────

  async listarAhorros(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.personal);
    return this.prisma.ahorroPersonal.findMany({
      where: { walletId },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearAhorro(datos: CrearAhorroPersonalDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.personal);
    return this.prisma.ahorroPersonal.create({
      data: {
        walletId: datos.walletId,
        nombre: datos.nombre.trim(),
        metaMonto: datos.metaMonto != null && datos.metaMonto > 0 ? datos.metaMonto : null,
        montoActual: datos.montoActual ?? 0,
      },
    });
  }

  async actualizarAhorro(id: number, datos: ActualizarAhorroPersonalDto, usuarioId: number) {
    const row = await this.prisma.ahorroPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Meta de ahorro no encontrada');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    return this.prisma.ahorroPersonal.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined && { nombre: datos.nombre.trim() }),
        ...(datos.metaMonto !== undefined && {
          metaMonto:
            datos.metaMonto === null || datos.metaMonto === 0 ? null : datos.metaMonto,
        }),
        ...(datos.montoActual !== undefined && { montoActual: datos.montoActual }),
      },
    });
  }

  async eliminarAhorro(id: number, usuarioId: number) {
    const row = await this.prisma.ahorroPersonal.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!row) throw new NotFoundException('Meta de ahorro no encontrada');
    if (row.wallet.usuarioId !== usuarioId || row.wallet.tipo !== TipoWallet.personal) {
      throw new ForbiddenException('Sin permiso');
    }
    await this.prisma.ahorroPersonal.delete({ where: { id } });
    return { mensaje: 'Meta de ahorro eliminada' };
  }
}
