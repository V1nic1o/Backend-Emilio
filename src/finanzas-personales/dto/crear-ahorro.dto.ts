import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CrearAhorroPersonalDto {
  @IsInt()
  @IsPositive()
  walletId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  metaMonto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoActual?: number;
}
