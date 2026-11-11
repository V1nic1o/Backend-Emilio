import { IsInt, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

export class CrearAsesoriaDto {
  @IsInt()
  @Min(1)
  walletId: number;

  @IsInt()
  @Min(1)
  personaId: number;

  @IsNumber()
  @Min(0.01)
  montoMensual: number;

  /** Porcentaje IVA; omitir o null = sin IVA. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  impuestoPct?: number | null;
}
