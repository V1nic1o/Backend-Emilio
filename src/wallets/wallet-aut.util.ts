import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';

/**
 * Verifica que el workspace exista y pertenezca al usuario (cualquier tipo: empresa o personal).
 */
export async function assertWalletUsuario(
  prisma: PrismaServicio,
  walletId: number,
  usuarioId: number,
): Promise<void> {
  const w = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!w) {
    throw new NotFoundException('Workspace no encontrado');
  }
  if (w.usuarioId == null) {
    throw new ForbiddenException(
      'Este workspace no está vinculado a ninguna cuenta. Creá uno nuevo desde la app o asigná usuarioId en la base de datos.',
    );
  }
  if (w.usuarioId !== usuarioId) {
    throw new ForbiddenException('No tenés permiso en este workspace');
  }
}

/**
 * Verifica que el workspace exista, pertenezca al usuario y sea del tipo esperado.
 */
export async function assertWalletUsuarioYTipo(
  prisma: PrismaServicio,
  walletId: number,
  usuarioId: number,
  tipoEsperado: TipoWallet,
): Promise<void> {
  const w = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!w) {
    throw new NotFoundException('Workspace no encontrado');
  }
  if (w.usuarioId == null) {
    throw new ForbiddenException(
      'Este workspace no está vinculado a ninguna cuenta. Creá uno nuevo desde la app o asigná usuarioId en la base de datos.',
    );
  }
  if (w.usuarioId !== usuarioId) {
    throw new ForbiddenException('No tenés permiso en este workspace');
  }
  if (w.tipo !== tipoEsperado) {
    throw new BadRequestException(
      tipoEsperado === TipoWallet.personal
        ? 'Esta acción solo está disponible en un workspace personal.'
        : 'Esta acción solo está disponible en un workspace de empresa.',
    );
  }
}
