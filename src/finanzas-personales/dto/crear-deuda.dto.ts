import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CrearDeudaPersonalDto {
  @IsInt()
  @IsPositive()
  walletId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  titulo: string;

  @IsNumber()
  @Min(0.01)
  montoOriginal: number;

  @IsOptional()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
