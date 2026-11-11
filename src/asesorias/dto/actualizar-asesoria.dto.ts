import { IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

export class ActualizarAsesoriaDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montoMensual?: number;

  /** null = quitar IVA; omitir = sin cambios. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  impuestoPct?: number | null;
}
