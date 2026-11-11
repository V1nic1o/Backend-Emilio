import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoPedido } from '@prisma/client';
import { CrearItemDto } from '../items/dto/crear-item.dto';
import { CrearPagoDto } from '../pagos/dto/crear-pago.dto';

/**
 * DTO para la creación de un pedido.
 * Permite incluir items y un pago inicial opcional en una sola operación.
 */
export class CrearPedidoDto {
  /** Compra: obligatorio (proveedor). Venta: opcional si se envía `proveedorId` (venta sin cliente conocido). */
  @IsOptional()
  @IsInt({ message: 'El ID de persona debe ser un entero' })
  @IsPositive({ message: 'El ID de persona debe ser positivo' })
  personaId?: number;

  @IsOptional()
  @IsInt({ message: 'El ID de proveedor debe ser un entero' })
  @IsPositive({ message: 'El ID de proveedor debe ser positivo' })
  proveedorId?: number;

  @IsEnum(TipoPedido, {
    message: 'El tipo debe ser "compra" o "venta"',
  })
  tipo: TipoPedido;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre o referencia no puede superar 200 caracteres' })
  nombreReferencia?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato ISO válido' })
  fecha?: string;

  @IsNotEmpty({ message: 'El pedido debe tener al menos un item' })
  @IsArray({ message: 'Los items deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => CrearItemDto)
  items: CrearItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  impuesto?: number;

  /** true = venta creada con modo "venta proveedor" (cliente paga al proveedor, proveedor reparte margen a empresa) */
  @IsOptional()
  @IsBoolean({ message: 'esIntermediacion debe ser un booleano' })
  esIntermediacion?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CrearPagoDto)
  pagoInicial?: CrearPagoDto;
}
