import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { TipoPersona } from '@prisma/client';

export class CrearPersonaDto {
  @IsInt({ message: 'El walletId debe ser un entero' })
  @IsPositive({ message: 'El walletId debe ser positivo' })
  walletId: number;

  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsEnum(TipoPersona, { message: 'El tipo debe ser "cliente" o "proveedor"' })
  tipo: TipoPersona;

  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30)  telefono?: string;
}
