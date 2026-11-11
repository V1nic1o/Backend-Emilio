import { Module } from '@nestjs/common';
import { PrismaModulo } from '../prisma/prisma.modulo';
import { FinanzasPersonalesServicio } from './finanzas-personales.servicio';
import { FinanzasPersonalesControlador } from './finanzas-personales.controlador';

@Module({
  imports: [PrismaModulo],
  controllers: [FinanzasPersonalesControlador],
  providers: [FinanzasPersonalesServicio],
})
export class FinanzasPersonalesModulo {}
