import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { CrearWalletDto } from './dto/crear-wallet.dto';
import { ActualizarWalletDto } from './dto/actualizar-wallet.dto';

/**
 * Servicio de Wallets.
 * Gestiona los espacios de trabajo aislados del usuario.
 */
@Injectable()
export class WalletsServicio {
  constructor(private readonly prisma: PrismaServicio) {}

  async crear(datos: CrearWalletDto, usuarioId: number) {
    const tipo = datos.tipo === 'personal' ? TipoWallet.personal : TipoWallet.empresa;
    return this.prisma.wallet.create({
      data: {
        usuarioId,
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        color: datos.color ?? '#2563EB',
        tipo,
      },
    });
  }

  async listar(usuarioId: number) {
    return this.prisma.wallet.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async obtenerPorId(id: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });

    if (!wallet) {
      throw new NotFoundException('Wallet no encontrado');
    }

    return wallet;
  }

  async actualizar(id: number, datos: ActualizarWalletDto, usuarioId: number) {
    const wallet = await this.obtenerPorId(id);

    if (wallet.usuarioId !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para modificar este workspace');
    }

    return this.prisma.wallet.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined && { nombre: datos.nombre }),
        ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
        ...(datos.color !== undefined && { color: datos.color }),
      },
    });
  }

  async eliminar(id: number, usuarioId: number) {
    const wallet = await this.obtenerPorId(id);

    if (wallet.usuarioId !== usuarioId) {
      throw new ForbiddenException('No tienes permiso para eliminar este workspace');
    }

    await this.prisma.wallet.delete({ where: { id } });

    return { mensaje: 'Wallet eliminado exitosamente' };
  }
}
