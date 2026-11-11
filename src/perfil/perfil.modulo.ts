import { Module } from '@nestjs/common';
import { PerfilServicio } from './perfil.servicio';
import { PerfilControlador } from './perfil.controlador';
import { PrismaModulo } from '../prisma/prisma.modulo';
import { CloudinaryLogoServicio } from '../comunes/cloudinary-logo.servicio';

@Module({
  imports: [PrismaModulo],
  controllers: [PerfilControlador],
  providers: [PerfilServicio, CloudinaryLogoServicio],
  exports: [PerfilServicio],
})
export class PerfilModulo {}
