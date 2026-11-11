import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoItem } from '@prisma/client';

/**
 * DTO para actualizar un producto del catálogo.
 * Todos los campos son opcionales.
 */
export class ActualizarProductoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoItem, { message: 'El tipo debe ser "bien" o "servicio"' })
  tipo?: TipoItem;

  @IsOptional()
  @IsNumber({}, { message: 'El precio del proveedor debe ser un número' })
  @Min(0, { message: 'El precio del proveedor no puede ser negativo' })
  precioProveedor?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio de la empresa debe ser un número' })
  @Min(0, { message: 'El precio de la empresa no puede ser negativo' })
  precioEmpresa?: number;

  /** Data URL (base64) de la imagen; se sube a Cloudinary si está configurado. */
  @IsOptional()
  @IsString()
  imagenBase64?: string;

  @IsOptional()
  @IsBoolean()
  eliminarImagen?: boolean;
}
