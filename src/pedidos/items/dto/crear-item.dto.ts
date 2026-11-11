import {
  IsBoolean,
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
 * DTO para crear un item dentro de un pedido.
 * Si el item proviene del catálogo, se puede incluir productoId como referencia.
 */
export class CrearItemDto {
  @IsOptional()
  @IsInt({ message: 'El productoId debe ser un entero' })
  @IsPositive({ message: 'El productoId debe ser positivo' })
  productoId?: number;

  @IsEnum(TipoItem, {
    message: 'El tipo debe ser "bien" o "servicio"',
  })
  tipo: TipoItem;

  @IsNotEmpty({ message: 'El nombre del item es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  nombre: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  cantidad: number;

  @IsNumber({}, { message: 'El precio de compra debe ser un número' })
  @Min(0, { message: 'El precio de compra no puede ser negativo' })
  precioCompra: number;

  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precioVenta: number;

  /** Si es true, se crea entrada nueva en el catálogo al guardar el ítem. Omitir o false = no sincronizar. */
  @IsOptional()
  @IsBoolean({ message: 'guardarEnCatalogo debe ser verdadero o falso' })
  guardarEnCatalogo?: boolean;
}
