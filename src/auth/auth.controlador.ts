import { Body, Controller, Get, Patch, Post, Request } from '@nestjs/common';
import { AuthServicio } from './auth.servicio';
import { LoginDto } from './dto/login.dto';
import { SolicitarResetDto } from './dto/solicitar-reset.dto';
import { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';
import { Public } from './public.decorador';

@Controller('auth')
export class AuthControlador {
  constructor(private readonly authServicio: AuthServicio) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authServicio.login(dto);
  }

  @Public()
  @Post('solicitar-reset')
  solicitarReset(@Body() dto: SolicitarResetDto) {
    return this.authServicio.solicitarReset(dto.email);
  }

  @Public()
  @Post('restablecer-contrasena')
  restablecerContrasena(@Body() dto: RestablecerContrasenaDto) {
    return this.authServicio.restablecerContrasena(dto.token, dto.nuevaPassword);
  }

  @Patch('contrasena')
  cambiarContrasena(
    @Request() req: { user: { id: number } },
    @Body() dto: CambiarContrasenaDto,
  ) {
    return this.authServicio.cambiarContrasena(req.user.id, dto.passwordActual, dto.nuevaPassword);
  }

  @Get('me')
  me(@Request() req: { user: { id: number } }) {
    return this.authServicio.perfil(req.user.id);
  }
}
