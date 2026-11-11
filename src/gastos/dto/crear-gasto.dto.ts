import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CrearGastoDto {
  @IsInt({ message: 'El walletId debe ser un entero' })
  @IsPositive({ message: 'El walletId debe ser positivo' })
  walletId: number;

  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(200, { message: 'La descripción no puede superar 200 caracteres' })
  descripcion: string;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  monto: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato ISO válido' })
  fecha?: string;

  @IsOptional()
  @IsString({ message: 'La categoría debe ser texto' })
  @MaxLength(50, { message: 'La categoría no puede superar 50 caracteres' })
  categoria?: string;

  /** Rubro de presupuesto personal (opcional). */
  @IsOptional()
  @IsInt()
  @IsPositive()
  presupuestoPersonalId?: number;
}
