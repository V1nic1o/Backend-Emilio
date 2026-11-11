import { IsEmail } from 'class-validator';

export class SolicitarResetDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;
}
