import { Global, Module } from '@nestjs/common';
import { PrismaServicio } from './prisma.servicio';

/**
 * Módulo global de Prisma.
 * Al ser @Global, el PrismaServicio está disponible en toda la aplicación
 * sin necesidad de importarlo en cada módulo.
 */
@Global()
@Module({
  providers: [PrismaServicio],
  exports: [PrismaServicio],
})
export class PrismaModulo {}
