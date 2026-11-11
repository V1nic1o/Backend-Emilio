import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * Actualización parcial de metadatos del pedido (nombre visible, impuesto y cliente).
 * Campos omitidos = sin cambio. impuesto: null = quitar impuesto del pedido.
 */
export class ActualizarPedidoDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200, { message: 'El nombre o referencia no puede superar 200 caracteres' })
  nombreReferencia?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({}, { message: 'El impuesto debe ser un número' })
  @Min(0, { message: 'El impuesto no puede ser negativo' })
  @Max(100, { message: 'El impuesto no puede superar 100%' })
  impuesto?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({}, { message: 'El ID de la persona debe ser un número' })
  personaId?: number | null;
}
