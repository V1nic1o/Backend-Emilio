import { Module } from '@nestjs/common';
import { EstadisticasControlador } from './estadisticas.controlador';
import { EstadisticasServicio } from './estadisticas.servicio';

@Module({
  controllers: [EstadisticasControlador],
  providers: [EstadisticasServicio],
})
export class EstadisticasModulo {}
