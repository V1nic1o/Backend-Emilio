import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * DTO para actualizar un wallet existente.
 * Todos los campos son opcionales (partial update).
 */
export class ActualizarWalletDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(80, { message: 'El nombre no puede superar 80 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(200, { message: 'La descripción no puede superar 200 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un hexadecimal válido (#RRGGBB)' })
  color?: string;
}
