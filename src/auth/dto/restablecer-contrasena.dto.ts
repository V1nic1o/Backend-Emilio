import { IsString, Matches, MinLength } from 'class-validator';

export class RestablecerContrasenaDto {
  /** Token hexadecimal de 64 caracteres enviado por email. */
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Token inválido' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  nuevaPassword: string;
}
