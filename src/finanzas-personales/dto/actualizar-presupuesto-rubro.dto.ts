import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActualizarPresupuestoRubroDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montoLimite?: number;
}
