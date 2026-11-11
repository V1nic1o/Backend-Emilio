import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { Resend } from 'resend';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { LoginDto } from './dto/login.dto';

const MSJ_RESET_GENERICO = {
  mensaje:
    'Si existe una cuenta con ese correo, recibirás un email con instrucciones para restablecer la contraseña. Revisá también spam o «Promociones» en Gmail.',
};

@Injectable()
export class AuthServicio {
  private readonly log = new Logger(AuthServicio.name);

  constructor(
    private readonly prisma: PrismaServicio,
    private readonly jwtService: JwtService,
  ) {}

  /** Respuesta genérica (no revela si el email existe). */
  async solicitarReset(emailRaw: string): Promise<typeof MSJ_RESET_GENERICO> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey || !from) {
      this.log.error(
        'RESEND_API_KEY y RESEND_FROM_EMAIL deben estar definidos; sin ellos no se puede enviar el correo de recuperación.',
      );
      throw new ServiceUnavailableException(
        'El envío de correo no está configurado en el servidor. Si administrás el backend, agregá RESEND_API_KEY y RESEND_FROM_EMAIL (p. ej. en Cloud Run / .env).',
      );
    }

    const email = emailRaw.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return MSJ_RESET_GENERICO;
    }

    const unaHora = new Date(Date.now() - 60 * 60 * 1000);
    const solicitudesRecientes = await this.prisma.passwordResetToken.count({
      where: { usuarioId: usuario.id, createdAt: { gte: unaHora } },
    });
    if (solicitudesRecientes >= 5) {
      this.log.warn(`Límite de solicitudes de reset por hora para usuario ${usuario.id}`);
      return MSJ_RESET_GENERICO;
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { usuarioId: usuario.id, usedAt: null },
    });

    const tokenPlano = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const fila = await this.prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiresAt,
      },
    });

    const webBase = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:8081').replace(/\/$/, '');
    const esquema = (process.env.APP_LINK_SCHEME ?? 'tikbal').replace(/:\/\//, '');
    const pathToken = encodeURIComponent(tokenPlano);
    const urlWeb = `${webBase}/restablecer-contrasena/${pathToken}`;
    const urlApp = `${esquema}://restablecer-contrasena/${pathToken}`;

    try {
      await this.enviarEmailResetResend(apiKey, from, usuario.email, usuario.nombre, urlWeb, urlApp);
    } catch (e: unknown) {
      await this.prisma.passwordResetToken.delete({ where: { id: fila.id } }).catch(() => {});
      this.log.error(e instanceof Error ? e.message : 'Error Resend');
      throw new InternalServerErrorException('No pudimos enviar el email. Intentá más tarde.');
    }

    return MSJ_RESET_GENERICO;
  }

  async restablecerContrasena(tokenPlano: string, nuevaPassword: string): Promise<{ mensaje: string }> {
    const tokenNorm = tokenPlano.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(tokenNorm)) {
      throw new BadRequestException('El enlace no es válido o expiró.');
    }

    const tokenHash = crypto.createHash('sha256').update(tokenNorm).digest('hex');
    const ahora = new Date();

    const fila = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: ahora },
      },
    });

    if (!fila) {
      throw new BadRequestException('El enlace no es válido o expiró.');
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 12);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: fila.usuarioId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: fila.id },
        data: { usedAt: ahora },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { usuarioId: fila.usuarioId, id: { not: fila.id } },
      }),
    ]);

    return { mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' };
  }

  async cambiarContrasena(
    usuarioId: number,
    passwordActual: string,
    nuevaPassword: string,
  ): Promise<{ mensaje: string }> {
    if (passwordActual === nuevaPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta a la actual.');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException();

    const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 12);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash },
    });

    return { mensaje: 'Contraseña actualizada.' };
  }

  private async enviarEmailResetResend(
    apiKey: string,
    from: string,
    to: string,
    nombre: string,
    urlWeb: string,
    urlApp: string,
  ): Promise<void> {
    const resend = new Resend(apiKey);
    const nombreSeguro = nombre
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `
<p>Hola ${nombreSeguro || 'ahí'},</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Tikb'al</strong>.</p>
<p><a href="${urlWeb}">Abrir en el navegador (web)</a></p>
<p><a href="${urlApp}">Abrir en la app</a> (si la tenés instalada)</p>
<p>Si no pediste este cambio, ignorá este mensaje. El enlace vence en 1 hora.</p>
`.trim();

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Restablecer contraseña — Tikb'al",
      html,
    });

    if (error) {
      this.log.error(`Resend rechazó el envío: ${error.message}`);
      throw new Error(error.message);
    }

    this.log.log(`Email de reset enviado (Resend id=${data?.id ?? 'n/a'}) a ${to}`);
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!usuario) throw new UnauthorizedException('Email o contraseña incorrectos');

    const valido = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!valido) throw new UnauthorizedException('Email o contraseña incorrectos');

    const token = this.jwtService.sign({ sub: usuario.id, email: usuario.email });
    return { token, usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre } };
  }

  async perfil(usuarioId: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, email: true, nombre: true, createdAt: true },
    });
    return usuario;
  }
}
