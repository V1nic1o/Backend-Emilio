import { Module } from '@nestjs/common';
import { PersonasControlador } from './personas.controlador';
import { PersonasServicio } from './personas.servicio';

@Module({
  controllers: [PersonasControlador],
  providers: [PersonasServicio],
  exports: [PersonasServicio],
})
export class PersonasModulo {}
