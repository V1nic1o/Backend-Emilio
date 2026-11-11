import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoItem } from '@prisma/client';

/**
 * DTO para crear un producto en el catálogo de un wallet.
 */
export class CrearProductoDto {
  @IsInt({ message: 'El walletId debe ser un entero' })
  @IsPositive({ message: 'El walletId debe ser positivo' })
  walletId: number;

  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  nombre: string;

  @IsOptional()
  @IsEnum(TipoItem, { message: 'El tipo debe ser "bien" o "servicio"' })
  tipo?: TipoItem;

  @IsNumber({}, { message: 'El precio del proveedor debe ser un número' })
  @Min(0, { message: 'El precio del proveedor no puede ser negativo' })
  precioProveedor: number;

  @IsNumber({}, { message: 'El precio de la empresa debe ser un número' })
  @Min(0, { message: 'El precio de la empresa no puede ser negativo' })
  precioEmpresa: number;

  /** Data URL opcional; tras crear el producto se sube a Cloudinary. */
  @IsOptional()
  @IsString()
  imagenBase64?: string;
}
