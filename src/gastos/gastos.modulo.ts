import { Module } from '@nestjs/common';
import { GastosControlador } from './gastos.controlador';
import { GastosServicio } from './gastos.servicio';

@Module({
  controllers: [GastosControlador],
  providers: [GastosServicio],
})
export class GastosModulo {}
