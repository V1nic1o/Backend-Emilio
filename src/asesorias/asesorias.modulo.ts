import { Module } from '@nestjs/common';
import { AsesoriasControlador } from './asesorias.controlador';
import { AsesoriasServicio } from './asesorias.servicio';

@Module({
  controllers: [AsesoriasControlador],
  providers: [AsesoriasServicio],
  exports: [AsesoriasServicio],
})
export class AsesoriasModulo {}
