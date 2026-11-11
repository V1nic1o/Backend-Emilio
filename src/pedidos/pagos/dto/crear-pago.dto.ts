import { IsNumber, IsOptional, IsPositive, IsDateString } from 'class-validator';

/**
 * DTO para registrar un pago (abono) a un pedido.
 */
export class CrearPagoDto {
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto del pago debe ser mayor a cero' })
  monto: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato ISO válido' })
  fecha?: string;
}
