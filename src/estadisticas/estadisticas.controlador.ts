import { Controller, Get, ParseIntPipe, Query, Request } from '@nestjs/common';
import { EstadisticasServicio } from './estadisticas.servicio';

/**
 * Controlador de Estadísticas.
 * Retorna métricas de ganancia bruta, neta y desglose mensual por wallet.
 */
@Controller('estadisticas')
export class EstadisticasControlador {
  constructor(private readonly estadisticasServicio: EstadisticasServicio) {}

  @Get('rango')
  obtenerResumenRango(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.estadisticasServicio.obtenerResumenRango(walletId, req.user.id, desde, hasta);
  }

  @Get('desglose-mes')
  obtenerDesgloseMes(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
    @Query('anio', ParseIntPipe) anio: number,
    @Query('mes', ParseIntPipe) mes: number,
  ) {
    return this.estadisticasServicio.obtenerDesgloseMes(walletId, req.user.id, anio, mes);
  }

  @Get('historial-meses')
  obtenerHistorialMeses(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.estadisticasServicio.obtenerHistorialMesesContables(walletId, req.user.id);
  }

  /**
   * GET /api/estadisticas?walletId=X
   * Retorna el resumen financiero del wallet indicado.
   */
  @Get()
  obtenerResumen(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.estadisticasServicio.obtenerResumen(walletId, req.user.id);
  }
}
