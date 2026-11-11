import { IsString, MinLength } from 'class-validator';

export class CambiarContrasenaDto {
  @IsString()
  @MinLength(1, { message: 'Ingresá tu contraseña actual' })
  passwordActual: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  nuevaPassword: string;
}
