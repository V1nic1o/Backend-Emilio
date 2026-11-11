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
import { PersonasServicio } from './personas.servicio';
import { CrearPersonaDto } from './dto/crear-persona.dto';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto';

/**
 * Controlador de Personas.
 * Expone los endpoints REST para clientes y proveedores por wallet.
 *
 * Base URL: /personas
 */
@Controller('personas')
export class PersonasControlador {
  constructor(private readonly personasServicio: PersonasServicio) {}

  /** POST /personas — crea una persona en el wallet especificado */
  @Post()
  crear(@Request() req: { user: { id: number } }, @Body() datos: CrearPersonaDto) {
    return this.personasServicio.crear(datos, req.user.id);
  }

  /** GET /personas?walletId=X — lista personas de un wallet */
  @Get()
  listar(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.personasServicio.listar(walletId, req.user.id);
  }

  /** GET /personas/:id — obtiene el detalle de una persona con sus pedidos */
  @Get(':id')
  obtenerPorId(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.personasServicio.obtenerPorId(id, req.user.id);
  }

  /** PATCH /personas/:id — actualiza nombre y/o tipo de una persona */
  @Patch(':id')
  actualizar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarPersonaDto,
  ) {
    return this.personasServicio.actualizar(id, datos, req.user.id);
  }

  /** DELETE /personas/:id — elimina la persona y sus pedidos en cascada */
  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.personasServicio.eliminar(id, req.user.id);
  }
}
