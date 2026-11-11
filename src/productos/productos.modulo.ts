import { Module } from '@nestjs/common';
import { ProductosServicio } from './productos.servicio';
import { ProductosControlador } from './productos.controlador';
import { CloudinaryLogoServicio } from '../comunes/cloudinary-logo.servicio';

@Module({
  controllers: [ProductosControlador],
  providers: [ProductosServicio, CloudinaryLogoServicio],
  exports: [ProductosServicio],
})
export class ProductosModulo {}
