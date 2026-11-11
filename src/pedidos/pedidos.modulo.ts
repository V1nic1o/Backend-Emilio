import { Module } from '@nestjs/common';
import { PedidosControlador } from './pedidos.controlador';
import { PedidosServicio } from './pedidos.servicio';
import { ProductosModulo } from '../productos/productos.modulo';

@Module({
  imports: [ProductosModulo],
  controllers: [PedidosControlador],
  providers: [PedidosServicio],
})
export class PedidosModulo {}
