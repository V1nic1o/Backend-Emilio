import { Body, Controller, Get, Patch, Query, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PerfilServicio } from './perfil.servicio';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilControlador {
  constructor(private readonly perfilServicio: PerfilServicio) {}

  /** Datos de empresa del workspace empresa indicado (PDFs / Mi empresa). */
  @Get()
  obtener(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.perfilServicio.obtener(walletId, req.user.id);
  }

  @Patch()
  actualizar(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.perfilServicio.actualizar(walletId, req.user.id, dto);
  }
}
