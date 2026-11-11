import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';

/**
 * DTO para registrar un movimiento con el proveedor del pedido:
 * - `pago`: le pagás al proveedor (reduce saldo de costo).
 * - `cobro`: el proveedor te paga (reduce lo debido por costo).
 * - `ingreso_cliente_a_proveedor`: clientes finales pagaron al proveedor (solo venta sin cliente en app; no afecta saldo de costo).
 */
export class CrearPagoProveedorDto {
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  monto: number;

  @IsOptional()
  @IsIn(['pago', 'cobro', 'ingreso_cliente_a_proveedor'], {
    message: 'El tipo debe ser pago, cobro o ingreso_cliente_a_proveedor',
  })
  tipo?: 'pago' | 'cobro' | 'ingreso_cliente_a_proveedor';

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato ISO válido' })
  fecha?: string;
}
