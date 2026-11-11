import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * DTO para crear un nuevo wallet (espacio de trabajo).
 */
export class CrearWalletDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(80, { message: 'El nombre no puede superar 80 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(200, { message: 'La descripción no puede superar 200 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un hexadecimal válido (#RRGGBB)' })
  color?: string;

  /** `empresa`: pedidos, personas, catálogo. `personal`: ingresos, gastos, deudas, ahorros. */
  @IsOptional()
  @IsIn(['empresa', 'personal'], { message: 'El tipo debe ser "empresa" o "personal"' })
  tipo?: 'empresa' | 'personal';
}
