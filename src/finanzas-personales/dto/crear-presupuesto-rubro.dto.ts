import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearPresupuestoRubroDto {
  @IsInt()
  @IsPositive()
  walletId: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsNumber()
  @Min(0.01)
  montoLimite: number;
}
