import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { WalletsServicio } from './wallets.servicio';
import { CrearWalletDto } from './dto/crear-wallet.dto';
import { ActualizarWalletDto } from './dto/actualizar-wallet.dto';

@Controller('wallets')
export class WalletsControlador {
  constructor(private readonly walletsServicio: WalletsServicio) {}

  @Post()
  crear(@Request() req: { user: { id: number } }, @Body() datos: CrearWalletDto) {
    return this.walletsServicio.crear(datos, req.user.id);
  }

  @Get()
  listar(@Request() req: { user: { id: number } }) {
    return this.walletsServicio.listar(req.user.id);
  }

  /** GET /wallets/:id — obtiene un wallet por ID */
  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.walletsServicio.obtenerPorId(id);
  }

  /** PATCH /wallets/:id — actualiza nombre, descripción o color */
  @Patch(':id')
  actualizar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarWalletDto,
  ) {
    return this.walletsServicio.actualizar(id, datos, req.user.id);
  }

  /** DELETE /wallets/:id — elimina el wallet y todo su contenido */
  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.walletsServicio.eliminar(id, req.user.id);
  }
}
