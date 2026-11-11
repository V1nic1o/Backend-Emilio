import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { PedidosServicio } from './pedidos.servicio';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { CrearPagoDto } from './pagos/dto/crear-pago.dto';
import { CrearPagoProveedorDto } from './pagos/dto/crear-pago-proveedor.dto';
import { CrearItemDto } from './items/dto/crear-item.dto';
import { ActualizarItemDto } from './items/dto/actualizar-item.dto';
import { ActualizarPedidoDto } from './dto/actualizar-pedido.dto';

/**
 * Controlador de Pedidos.
 * Expone los endpoints REST para gestionar pedidos, pagos e ítems.
 *
 * Base URL: /pedidos
 */
@Controller('pedidos')
export class PedidosControlador {
  constructor(private readonly pedidosServicio: PedidosServicio) {}

  /** POST /pedidos — crea un pedido con items y pago inicial opcional */
  @Post()
  crear(
    @Request() req: { user: { id: number } },
    @Body() datos: CrearPedidoDto,
  ) {
    return this.pedidosServicio.crear(datos, req.user.id);
  }

  /** GET /pedidos?walletId=X — lista pedidos de un wallet */
  @Get()
  listar(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.pedidosServicio.listar(walletId, req.user.id);
  }

  /** GET /pedidos/:id — detalle completo de un pedido */
  @Get(':id')
  obtenerDetalle(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pedidosServicio.obtenerDetalle(id, req.user.id);
  }

  /** PATCH /pedidos/:id — nombre/referencia e impuesto (%), sin tocar ítems ni pagos */
  @Patch(':id')
  actualizarPedido(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarPedidoDto,
  ) {
    return this.pedidosServicio.actualizar(id, datos, req.user.id);
  }

  /** POST /pedidos/:id/pagos — registra un abono */
  @Post(':id/pagos')
  registrarPago(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CrearPagoDto,
  ) {
    return this.pedidosServicio.registrarPago(id, datos, req.user.id);
  }

  /** DELETE /pedidos/:id/pagos/:pagoId — elimina un pago del cliente */
  @Delete(':id/pagos/:pagoId')
  eliminarPago(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Param('pagoId', ParseIntPipe) pagoId: number,
  ) {
    return this.pedidosServicio.eliminarPago(id, pagoId, req.user.id);
  }

  /** DELETE /pedidos/:id/pagos-proveedor/:pagoId — elimina un pago al proveedor */
  @Delete(':id/pagos-proveedor/:pagoId')
  eliminarPagoProveedor(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Param('pagoId', ParseIntPipe) pagoId: number,
  ) {
    return this.pedidosServicio.eliminarPagoProveedor(id, pagoId, req.user.id);
  }

  /** POST /pedidos/:id/pagos-proveedor — registra un pago al proveedor */
  @Post(':id/pagos-proveedor')
  registrarPagoProveedor(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CrearPagoProveedorDto,
  ) {
    return this.pedidosServicio.registrarPagoProveedor(id, datos, req.user.id);
  }

  /** DELETE /pedidos/:id — elimina el pedido y todo su contenido */
  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pedidosServicio.eliminar(id, req.user.id);
  }

  // ─── Gestión de ítems individuales ───────────────────────────────────────

  /** POST /pedidos/:id/items — agrega un ítem a un pedido existente */
  @Post(':id/items')
  agregarItem(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CrearItemDto,
  ) {
    return this.pedidosServicio.agregarItem(id, datos, req.user.id);
  }

  /** PATCH /pedidos/:id/items/:itemId — actualiza un ítem */
  @Patch(':id/items/:itemId')
  actualizarItem(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() datos: ActualizarItemDto,
  ) {
    return this.pedidosServicio.actualizarItem(id, itemId, datos, req.user.id);
  }

  /** DELETE /pedidos/:id/items/:itemId — elimina un ítem del pedido */
  @Delete(':id/items/:itemId')
  eliminarItem(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.pedidosServicio.eliminarItem(id, itemId, req.user.id);
  }
}
