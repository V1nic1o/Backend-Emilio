import { IsInt, IsPositive, Max, Min } from 'class-validator';

export class CopiarPresupuestosDto {
  @IsInt()
  @IsPositive()
  walletId: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  anioOrigen: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mesOrigen: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  anioDestino: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mesDestino: number;
}
