import { Module } from '@nestjs/common';
import { WalletsServicio } from './wallets.servicio';
import { WalletsControlador } from './wallets.controlador';

@Module({
  controllers: [WalletsControlador],
  providers: [WalletsServicio],
})
export class WalletsModulo {}
