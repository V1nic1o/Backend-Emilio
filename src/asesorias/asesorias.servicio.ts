import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoAsesoriaCobro, TipoPersona, TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';
import { redondearMoneda } from '../comunes/utilidades/calculadora-pedido.util';
import { MENSAJES } from '../comunes/constantes/mensajes.constante';
import { CrearAsesoriaDto } from './dto/crear-asesoria.dto';
import { ActualizarAsesoriaDto } from './dto/actualizar-asesoria.dto';
import { mesesRangoInclusivo, periodoDesdeFecha } from './util/periodo-meses-asesoria.util';

function montosDesdeSuscripcion(montoMensual: number, impuestoPct: number | null | undefined) {
  const montoBase = redondearMoneda(montoMensual);
  if (impuestoPct == null || impuestoPct <= 0) {
    return { montoBase, montoIva: 0, montoTotal: montoBase };
  }
  const montoIva = redondearMoneda(montoBase * (impuestoPct / 100));
  return { montoBase, montoIva, montoTotal: redondearMoneda(montoBase + montoIva) };
}

@Injectable()
export class AsesoriasServicio {
  constructor(
    private readonly prisma: PrismaServicio,
    private readonly config: ConfigService,
  ) {}

  private async assertWalletEmpresaUsuario(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
  }

  private async assertPersonaClienteWallet(personaId: number, walletId: number) {
    const persona = await this.prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) throw new NotFoundException(MENSAJES.PERSONA.NO_ENCONTRADA);
    if (persona.walletId !== walletId) {
      throw new BadRequestException(MENSAJES.ASESORIA.WALLET_PERSONA);
    }
    if (persona.tipo !== TipoPersona.cliente) {
      throw new BadRequestException(MENSAJES.ASESORIA.SOLO_CLIENTE);
    }
    return persona;
  }

  private async assertSuscripcionWallet(suscripcionId: number, walletId: number) {
    const sub = await this.prisma.asesoriaSuscripcion.findUnique({
      where: { id: suscripcionId },
      include: { persona: true },
    });
    if (!sub) throw new NotFoundException(MENSAJES.ASESORIA.NO_ENCONTRADA);
    if (sub.persona.walletId !== walletId) {
      throw new BadRequestException(MENSAJES.ASESORIA.WALLET_PERSONA);
    }
    return sub;
  }

  private async assertCobroWallet(cobroId: number, walletId: number) {
    const cobro = await this.prisma.asesoriaCobro.findUnique({
      where: { id: cobroId },
      include: { suscripcion: { include: { persona: true } } },
    });
    if (!cobro) throw new NotFoundException(MENSAJES.ASESORIA.COBRO_NO_ENCONTRADO);
    if (cobro.suscripcion.persona.walletId !== walletId) {
      throw new BadRequestException(MENSAJES.ASESORIA.WALLET_PERSONA);
    }
    return cobro;
  }

  /**
   * Crea el registro de cobro del período (año/mes) si no existe.
   */
  async ensureCobroPeriodo(
    suscripcionId: number,
    anio: number,
    mes: number,
    montoMensual: number,
    impuestoPct: number | null,
  ) {
    const existente = await this.prisma.asesoriaCobro.findUnique({
      where: { suscripcionId_anio_mes: { suscripcionId, anio, mes } },
    });
    if (existente) return existente;
    const m = montosDesdeSuscripcion(montoMensual, impuestoPct);
    return this.prisma.asesoriaCobro.create({
      data: {
        suscripcionId,
        anio,
        mes,
        montoBase: m.montoBase,
        montoIva: m.montoIva,
        montoTotal: m.montoTotal,
        estado: EstadoAsesoriaCobro.pendiente,
      },
    });
  }

  /** Rellena cobros faltantes de todas las suscripciones activas del wallet hasta el mes actual. */
  private async asegurarCobrosActivasDelWallet(walletId: number) {
    const subs = await this.prisma.asesoriaSuscripcion.findMany({
      where: { activa: true, persona: { walletId } },
    });
    const { anio, mes } = periodoDesdeFecha(new Date());
    for (const s of subs) {
      await this.asegurarCobrosDesdeAltaHastaMes(s, anio, mes);
    }
  }

  /** Crea cobros faltantes desde el mes de alta hasta el mes indicado (inclusive). Idempotente. */
  private async asegurarCobrosDesdeAltaHastaMes(
    suscripcion: {
      id: number;
      montoMensual: number;
      impuestoPct: number | null;
      createdAt: Date;
    },
    hastaAnio: number,
    hastaMes: number,
  ) {
    const inicio = periodoDesdeFecha(suscripcion.createdAt);
    const fin = { anio: hastaAnio, mes: hastaMes };
    for (const { anio, mes } of mesesRangoInclusivo(inicio, fin)) {
      await this.ensureCobroPeriodo(suscripcion.id, anio, mes, suscripcion.montoMensual, suscripcion.impuestoPct);
    }
  }

  async crear(datos: CrearAsesoriaDto, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(datos.walletId, usuarioId);
    await this.assertPersonaClienteWallet(datos.personaId, datos.walletId);
    const duplicada = await this.prisma.asesoriaSuscripcion.findUnique({
      where: { personaId: datos.personaId },
    });
    if (duplicada) {
      throw new ConflictException(MENSAJES.ASESORIA.YA_EXISTE);
    }
    const pct =
      datos.impuestoPct === undefined || datos.impuestoPct === null || datos.impuestoPct <= 0
        ? null
        : datos.impuestoPct;
    const sub = await this.prisma.asesoriaSuscripcion.create({
      data: {
        personaId: datos.personaId,
        montoMensual: datos.montoMensual,
        impuestoPct: pct,
        activa: true,
      },
    });
    const hoy = periodoDesdeFecha(new Date());
    await this.asegurarCobrosDesdeAltaHastaMes(sub, hoy.anio, hoy.mes);
    return this.obtenerPorPersona(datos.personaId, datos.walletId, usuarioId);
  }

  async obtenerPorPersona(personaId: number, walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    const persona = await this.prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) throw new NotFoundException(MENSAJES.PERSONA.NO_ENCONTRADA);
    if (persona.walletId !== walletId) {
      throw new BadRequestException(MENSAJES.ASESORIA.WALLET_PERSONA);
    }
    if (persona.tipo !== TipoPersona.cliente) {
      return { suscripcion: null };
    }
    const base = await this.prisma.asesoriaSuscripcion.findUnique({ where: { personaId } });
    if (base?.activa) {
      const { anio, mes } = periodoDesdeFecha(new Date());
      await this.asegurarCobrosDesdeAltaHastaMes(base, anio, mes);
    }
    const suscripcion = await this.prisma.asesoriaSuscripcion.findUnique({
      where: { personaId },
      include: {
        cobros: { orderBy: [{ anio: 'desc' }, { mes: 'desc' }] },
      },
    });
    return { suscripcion };
  }

  async listarPendientes(walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    await this.asegurarCobrosActivasDelWallet(walletId);
    const cobros = await this.prisma.asesoriaCobro.findMany({
      where: {
        estado: EstadoAsesoriaCobro.pendiente,
        suscripcion: { persona: { walletId } },
      },
      include: {
        suscripcion: { include: { persona: { select: { id: true, nombre: true } } } },
      },
      orderBy: [{ anio: 'asc' }, { mes: 'asc' }, { id: 'asc' }],
    });
    return cobros.map((c) => ({
      cobroId: c.id,
      personaId: c.suscripcion.persona.id,
      personaNombre: c.suscripcion.persona.nombre,
      suscripcionId: c.suscripcionId,
      anio: c.anio,
      mes: c.mes,
      montoTotal: c.montoTotal,
      montoBase: c.montoBase,
      montoIva: c.montoIva,
    }));
  }

  async actualizar(
    suscripcionId: number,
    walletId: number,
    datos: ActualizarAsesoriaDto,
    usuarioId: number,
  ) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    if (datos.montoMensual === undefined && datos.impuestoPct === undefined) {
      throw new BadRequestException(MENSAJES.ASESORIA.SIN_CAMPOS_ACTUALIZAR);
    }
    const sub = await this.assertSuscripcionWallet(suscripcionId, walletId);
    const pctNext =
      datos.impuestoPct === undefined
        ? sub.impuestoPct
        : datos.impuestoPct === null || datos.impuestoPct <= 0
          ? null
          : datos.impuestoPct;
    const montoNext = datos.montoMensual !== undefined ? datos.montoMensual : sub.montoMensual;

    const actualizada = await this.prisma.asesoriaSuscripcion.update({
      where: { id: suscripcionId },
      data: {
        ...(datos.montoMensual !== undefined && { montoMensual: datos.montoMensual }),
        ...(datos.impuestoPct !== undefined && { impuestoPct: pctNext }),
      },
    });

    const m = montosDesdeSuscripcion(montoNext, pctNext);
    await this.prisma.asesoriaCobro.updateMany({
      where: { suscripcionId, estado: EstadoAsesoriaCobro.pendiente },
      data: {
        montoBase: m.montoBase,
        montoIva: m.montoIva,
        montoTotal: m.montoTotal,
      },
    });

    return this.obtenerPorPersona(actualizada.personaId, walletId, usuarioId);
  }

  async desactivar(suscripcionId: number, walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    const sub = await this.assertSuscripcionWallet(suscripcionId, walletId);
    await this.prisma.asesoriaSuscripcion.update({
      where: { id: suscripcionId },
      data: { activa: false },
    });
    return this.obtenerPorPersona(sub.personaId, walletId, usuarioId);
  }

  async activar(suscripcionId: number, walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    const sub = await this.assertSuscripcionWallet(suscripcionId, walletId);
    await this.prisma.asesoriaSuscripcion.update({
      where: { id: suscripcionId },
      data: { activa: true },
    });
    const fresh = await this.prisma.asesoriaSuscripcion.findUniqueOrThrow({ where: { id: suscripcionId } });
    const hoy = periodoDesdeFecha(new Date());
    await this.asegurarCobrosDesdeAltaHastaMes(fresh, hoy.anio, hoy.mes);
    return this.obtenerPorPersona(sub.personaId, walletId, usuarioId);
  }

  async marcarPagada(cobroId: number, walletId: number, fechaPagoIso: string | undefined, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    const cobro = await this.assertCobroWallet(cobroId, walletId);
    if (cobro.estado === EstadoAsesoriaCobro.pagada) {
      throw new BadRequestException(MENSAJES.ASESORIA.YA_PAGADA);
    }
    const fechaPago = fechaPagoIso ? new Date(fechaPagoIso) : new Date();
    if (Number.isNaN(fechaPago.getTime())) {
      throw new BadRequestException(MENSAJES.ASESORIA.FECHA_PAGO_INVALIDA);
    }
    await this.prisma.asesoriaCobro.update({
      where: { id: cobroId },
      data: { estado: EstadoAsesoriaCobro.pagada, fechaPago },
    });
    return this.obtenerPorPersona(cobro.suscripcion.personaId, walletId, usuarioId);
  }

  /** Asegura cobros desde el mes de alta hasta el mes calendario actual (rellena meses saltados). */
  async sincronizarWallet(walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    const subs = await this.prisma.asesoriaSuscripcion.findMany({
      where: { activa: true, persona: { walletId } },
    });
    const { anio, mes } = periodoDesdeFecha(new Date());
    await this.asegurarCobrosActivasDelWallet(walletId);
    return { sincronizadas: subs.length, anio, mes };
  }

  /** Cron global: todas las suscripciones activas (todos los wallets). */
  async generarMensualesGlobal() {
    const subs = await this.prisma.asesoriaSuscripcion.findMany({ where: { activa: true } });
    const { anio, mes } = periodoDesdeFecha(new Date());
    let creados = 0;
    for (const s of subs) {
      const antes = await this.prisma.asesoriaCobro.count({ where: { suscripcionId: s.id } });
      await this.asegurarCobrosDesdeAltaHastaMes(s, anio, mes);
      const despues = await this.prisma.asesoriaCobro.count({ where: { suscripcionId: s.id } });
      creados += despues - antes;
    }
    return { procesadas: subs.length, periodo: { anio, mes }, nuevasEnPeriodo: creados };
  }

  verificarCronSecret(secret: string | undefined) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException(MENSAJES.ASESORIA.CRON_NO_AUTORIZADO);
    }
  }

  async eliminar(suscripcionId: number, walletId: number, usuarioId: number) {
    await this.assertWalletEmpresaUsuario(walletId, usuarioId);
    await this.assertSuscripcionWallet(suscripcionId, walletId);
    await this.prisma.asesoriaSuscripcion.delete({ where: { id: suscripcionId } });
    return { mensaje: MENSAJES.ASESORIA.ELIMINADA };
  }
}
