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
import { ProductosServicio } from './productos.servicio';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';

/**
 * Controlador de Productos.
 * Expone el catálogo de productos/servicios por wallet.
 *
 * Base URL: /productos
 */
@Controller('productos')
export class ProductosControlador {
  constructor(private readonly productosServicio: ProductosServicio) {}

  /** POST /productos — crea un producto en el catálogo */
  @Post()
  crear(@Request() req: { user: { id: number } }, @Body() datos: CrearProductoDto) {
    return this.productosServicio.crear(datos, req.user.id);
  }

  /** GET /productos?walletId=X — lista el catálogo de un wallet */
  @Get()
  listar(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.productosServicio.listarPorWallet(walletId, req.user.id);
  }

  /** GET /productos/:id — obtiene un producto por ID */
  @Get(':id')
  obtenerPorId(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productosServicio.obtenerPorId(id, req.user.id);
  }

  /** PATCH /productos/:id — actualiza nombre o precios */
  @Patch(':id')
  actualizar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarProductoDto,
  ) {
    return this.productosServicio.actualizar(id, datos, req.user.id);
  }

  /** DELETE /productos/:id — elimina el producto del catálogo */
  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productosServicio.eliminar(id, req.user.id);
  }
}
