import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CrearIngresoPersonalDto {
  @IsInt()
  @IsPositive()
  walletId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  descripcion: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  fecha?: string;
}
