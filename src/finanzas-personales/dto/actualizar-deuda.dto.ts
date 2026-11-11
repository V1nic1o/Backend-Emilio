import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActualizarDeudaPersonalDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoOriginal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoPagado?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
