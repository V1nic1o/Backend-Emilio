import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoItem } from '@prisma/client';

/**
 * DTO para actualizar un item existente dentro de un pedido.
 * Todos los campos son opcionales.
 */
export class ActualizarItemDto {
  @IsOptional()
  @IsEnum(TipoItem, { message: 'El tipo debe ser "bien" o "servicio"' })
  tipo?: TipoItem;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  cantidad?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio de compra debe ser un número' })
  @Min(0, { message: 'El precio de compra no puede ser negativo' })
  precioCompra?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precioVenta?: number;
}
