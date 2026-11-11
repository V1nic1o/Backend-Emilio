import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoPersona } from '@prisma/client';

export class ActualizarPersonaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) nombre?: string;
  @IsOptional() @IsEnum(TipoPersona, { message: 'El tipo debe ser "cliente" o "proveedor"' }) tipo?: TipoPersona;
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30)  telefono?: string;
}
