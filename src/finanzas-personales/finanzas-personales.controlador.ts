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
import { FinanzasPersonalesServicio } from './finanzas-personales.servicio';
import { CrearIngresoPersonalDto } from './dto/crear-ingreso.dto';
import { CrearDeudaPersonalDto } from './dto/crear-deuda.dto';
import { ActualizarDeudaPersonalDto } from './dto/actualizar-deuda.dto';
import { CrearAhorroPersonalDto } from './dto/crear-ahorro.dto';
import { ActualizarAhorroPersonalDto } from './dto/actualizar-ahorro.dto';
import { ActualizarIngresoPersonalDto } from './dto/actualizar-ingreso.dto';
import { CrearPresupuestoRubroDto } from './dto/crear-presupuesto-rubro.dto';
import { ActualizarPresupuestoRubroDto } from './dto/actualizar-presupuesto-rubro.dto';
import { CopiarPresupuestosDto } from './dto/copiar-presupuestos.dto';

@Controller('finanzas-personales')
export class FinanzasPersonalesControlador {
  constructor(private readonly servicio: FinanzasPersonalesServicio) {}

  @Get('resumen')
  resumen(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.servicio.resumen(walletId, req.user.id);
  }

  @Get('ingresos')
  listarIngresos(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.servicio.listarIngresos(walletId, req.user.id);
  }

  @Post('ingresos')
  crearIngreso(@Request() req: { user: { id: number } }, @Body() datos: CrearIngresoPersonalDto) {
    return this.servicio.crearIngreso(datos, req.user.id);
  }

  @Patch('ingresos/:id')
  actualizarIngreso(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarIngresoPersonalDto,
  ) {
    return this.servicio.actualizarIngreso(id, datos, req.user.id);
  }

  @Delete('ingresos/:id')
  eliminarIngreso(@Request() req: { user: { id: number } }, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminarIngreso(id, req.user.id);
  }

  @Get('deudas')
  listarDeudas(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.servicio.listarDeudas(walletId, req.user.id);
  }

  @Post('deudas')
  crearDeuda(@Request() req: { user: { id: number } }, @Body() datos: CrearDeudaPersonalDto) {
    return this.servicio.crearDeuda(datos, req.user.id);
  }

  @Patch('deudas/:id')
  actualizarDeuda(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarDeudaPersonalDto,
  ) {
    return this.servicio.actualizarDeuda(id, datos, req.user.id);
  }

  @Delete('deudas/:id')
  eliminarDeuda(@Request() req: { user: { id: number } }, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminarDeuda(id, req.user.id);
  }

  @Get('ahorros')
  listarAhorros(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.servicio.listarAhorros(walletId, req.user.id);
  }

  @Post('ahorros')
  crearAhorro(@Request() req: { user: { id: number } }, @Body() datos: CrearAhorroPersonalDto) {
    return this.servicio.crearAhorro(datos, req.user.id);
  }

  @Patch('ahorros/:id')
  actualizarAhorro(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarAhorroPersonalDto,
  ) {
    return this.servicio.actualizarAhorro(id, datos, req.user.id);
  }

  @Delete('ahorros/:id')
  eliminarAhorro(@Request() req: { user: { id: number } }, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminarAhorro(id, req.user.id);
  }

  @Get('presupuestos')
  listarPresupuestosMes(
    @Request() req: { user: { id: number } },
    @Query('walletId', ParseIntPipe) walletId: number,
    @Query('anio', ParseIntPipe) anio: number,
    @Query('mes', ParseIntPipe) mes: number,
  ) {
    return this.servicio.listarPresupuestosMes(walletId, req.user.id, anio, mes);
  }

  @Post('presupuestos')
  crearPresupuestoRubro(
    @Request() req: { user: { id: number } },
    @Body() datos: CrearPresupuestoRubroDto,
  ) {
    return this.servicio.crearPresupuestoRubro(datos, req.user.id);
  }

  @Patch('presupuestos/:id')
  actualizarPresupuestoRubro(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarPresupuestoRubroDto,
  ) {
    return this.servicio.actualizarPresupuestoRubro(id, datos, req.user.id);
  }

  @Delete('presupuestos/:id')
  eliminarPresupuestoRubro(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.eliminarPresupuestoRubro(id, req.user.id);
  }

  @Post('presupuestos/copiar')
  copiarPresupuestosMes(
    @Request() req: { user: { id: number } },
    @Body() datos: CopiarPresupuestosDto,
  ) {
    return this.servicio.copiarPresupuestosMes(datos, req.user.id);
  }
}
