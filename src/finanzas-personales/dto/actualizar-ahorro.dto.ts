import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActualizarAhorroPersonalDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  metaMonto?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoActual?: number;
}
