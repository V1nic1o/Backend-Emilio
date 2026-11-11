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
import { GastosServicio } from './gastos.servicio';
import { CrearGastoDto } from './dto/crear-gasto.dto';
import { ActualizarGastoDto } from './dto/actualizar-gasto.dto';
import { CrearCategoriaGastoDto } from './dto/crear-categoria-gasto.dto';

/**
 * Controlador de Gastos.
 * Expone los endpoints REST para la gestión de egresos por wallet.
 *
 * Base URL: /gastos
 */
@Controller('gastos')
export class GastosControlador {
  constructor(private readonly gastosServicio: GastosServicio) {}

  /** POST /gastos — registra un nuevo gasto */
  @Post()
  crear(
    @Request() req: { user: { id: number } },
    @Body() datos: CrearGastoDto,
  ) {
    return this.gastosServicio.crear(datos, req.user.id);
  }

  /** GET /gastos?walletId=X — lista gastos de un wallet */
  @Get()
  listar(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.gastosServicio.listar(walletId, req.user.id);
  }

  /** GET /gastos/categorias?walletId=X — categorías personalizadas del wallet */
  @Get('categorias')
  listarCategorias(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.gastosServicio.listarCategorias(walletId, req.user.id);
  }

  /** POST /gastos/categorias — guarda una categoría personalizada */
  @Post('categorias')
  crearCategoria(
    @Request() req: { user: { id: number } },
    @Body() datos: CrearCategoriaGastoDto,
  ) {
    return this.gastosServicio.crearCategoria(datos, req.user.id);
  }

  /** PATCH /gastos/:id — actualiza descripción, monto, fecha o categoría */
  @Patch(':id')
  actualizar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarGastoDto,
  ) {
    return this.gastosServicio.actualizar(id, datos, req.user.id);
  }

  /** DELETE /gastos/:id — elimina un gasto */
  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.gastosServicio.eliminar(id, req.user.id);
  }
}
