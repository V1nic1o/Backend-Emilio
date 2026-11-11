import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AsesoriasServicio } from './asesorias.servicio';
import { CrearAsesoriaDto } from './dto/crear-asesoria.dto';
import { ActualizarAsesoriaDto } from './dto/actualizar-asesoria.dto';
import { MarcarPagadaAsesoriaDto } from './dto/marcar-pagada-asesoria.dto';
import { Public } from '../auth/public.decorador';

/**
 * Asesorías mensuales por cliente (suscripción + cobros pendientes / pagados).
 * Base: /api/asesorias
 */
@Controller('asesorias')
export class AsesoriasControlador {
  constructor(private readonly asesoriasServicio: AsesoriasServicio) {}

  private parseWalletId(walletId?: string): number {
    const id = walletId ? parseInt(walletId, 10) : NaN;
    if (!Number.isFinite(id) || id < 1) {
      throw new BadRequestException('walletId inválido');
    }
    return id;
  }

  @Get('pendientes')
  listarPendientes(
    @Request() req: { user: { id: number } },
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.listarPendientes(this.parseWalletId(walletId), req.user.id);
  }

  @Get('persona/:personaId')
  obtenerPorPersona(
    @Request() req: { user: { id: number } },
    @Param('personaId', ParseIntPipe) personaId: number,
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.obtenerPorPersona(
      personaId,
      this.parseWalletId(walletId),
      req.user.id,
    );
  }

  @Post('sincronizar')
  sincronizar(
    @Request() req: { user: { id: number } },
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.sincronizarWallet(this.parseWalletId(walletId), req.user.id);
  }

  /** Llamada programada (p. ej. Cloud Scheduler el día 1). Requiere header x-cron-secret. */
  @Public()
  @Post('cron/generar-mensuales')
  generarMensualesCron(@Headers('x-cron-secret') secret: string | undefined) {
    this.asesoriasServicio.verificarCronSecret(secret);
    return this.asesoriasServicio.generarMensualesGlobal();
  }

  @Post('cobros/:cobroId/marcar-pagada')
  marcarPagada(
    @Request() req: { user: { id: number } },
    @Param('cobroId', ParseIntPipe) cobroId: number,
    @Query('walletId') walletId: string | undefined,
    @Body() body: MarcarPagadaAsesoriaDto,
  ) {
    return this.asesoriasServicio.marcarPagada(
      cobroId,
      this.parseWalletId(walletId),
      body?.fechaPago,
      req.user.id,
    );
  }

  @Post()
  crear(
    @Request() req: { user: { id: number } },
    @Body() datos: CrearAsesoriaDto,
  ) {
    return this.asesoriasServicio.crear(datos, req.user.id);
  }

  @Patch(':id')
  actualizar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Query('walletId') walletId: string | undefined,
    @Body() datos: ActualizarAsesoriaDto,
  ) {
    return this.asesoriasServicio.actualizar(
      id,
      this.parseWalletId(walletId),
      datos,
      req.user.id,
    );
  }

  @Post(':id/desactivar')
  desactivar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.desactivar(id, this.parseWalletId(walletId), req.user.id);
  }

  @Post(':id/activar')
  activar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.activar(id, this.parseWalletId(walletId), req.user.id);
  }

  @Delete(':id')
  eliminar(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Query('walletId') walletId?: string,
  ) {
    return this.asesoriasServicio.eliminar(id, this.parseWalletId(walletId), req.user.id);
  }
}
