import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CloudinaryLogoServicio } from '../comunes/cloudinary-logo.servicio';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';

const perfilPorDefecto = (walletId: number) => ({
  walletId,
  nombreEmpresa: null as string | null,
  logoBase64: null as string | null,
  logoUrl: null as string | null,
  logoCloudinaryPublicId: null as string | null,
  direccion: null as string | null,
  email: null as string | null,
  telefono: null as string | null,
  nit: null as string | null,
});

@Injectable()
export class PerfilServicio {
  constructor(
    private readonly prisma: PrismaServicio,
    private readonly cloudinaryLogo: CloudinaryLogoServicio,
  ) {}

  async obtener(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    const perfil = await this.prisma.perfilEmpresa.findUnique({ where: { walletId } });
    return perfil ?? perfilPorDefecto(walletId);
  }

  async actualizar(walletId: number, usuarioId: number, dto: ActualizarPerfilDto) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);

    const existente = await this.prisma.perfilEmpresa.findUnique({ where: { walletId } });

    let nombreEmpresa = existente?.nombreEmpresa ?? null;
    let direccion = existente?.direccion ?? null;
    let email = existente?.email ?? null;
    let telefono = existente?.telefono ?? null;
    let nit = existente?.nit ?? null;
    let logoBase64 = existente?.logoBase64 ?? null;
    let logoUrl = existente?.logoUrl ?? null;
    let logoCloudinaryPublicId = existente?.logoCloudinaryPublicId ?? null;

    if (dto.nombreEmpresa !== undefined) {
      nombreEmpresa = dto.nombreEmpresa.trim() || null;
    }
    if (dto.direccion !== undefined) {
      direccion = dto.direccion.trim() || null;
    }
    if (dto.email !== undefined) {
      email = dto.email.trim() || null;
    }
    if (dto.telefono !== undefined) {
      telefono = dto.telefono.trim() || null;
    }
    if (dto.nit !== undefined) {
      nit = dto.nit.trim() || null;
    }

    if (dto.eliminarLogo === true) {
      if (logoCloudinaryPublicId) {
        await this.cloudinaryLogo.eliminar(logoCloudinaryPublicId);
      }
      logoBase64 = null;
      logoUrl = null;
      logoCloudinaryPublicId = null;
    } else if (dto.logoBase64 !== undefined && dto.logoBase64.trim() !== '') {
      const raw = dto.logoBase64.trim();
      if (this.cloudinaryLogo.estaActivo()) {
        try {
          if (logoCloudinaryPublicId) {
            await this.cloudinaryLogo.eliminar(logoCloudinaryPublicId);
          }
          const subido = await this.cloudinaryLogo.subirLogoWallet(walletId, raw);
          logoUrl = subido.secureUrl;
          logoCloudinaryPublicId = subido.publicId;
          logoBase64 = null;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error desconocido';
          throw new BadRequestException(`No se pudo subir el logo: ${msg}`);
        }
      } else {
        logoUrl = null;
        logoCloudinaryPublicId = null;
        logoBase64 = raw;
      }
    }

    return this.prisma.perfilEmpresa.upsert({
      where: { walletId },
      update: {
        nombreEmpresa,
        direccion,
        email,
        telefono,
        nit,
        logoBase64,
        logoUrl,
        logoCloudinaryPublicId,
      },
      create: {
        walletId,
        nombreEmpresa,
        direccion,
        email,
        telefono,
        nit,
        logoBase64,
        logoUrl,
        logoCloudinaryPublicId,
      },
    });
  }
}
