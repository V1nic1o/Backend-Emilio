import { IsISO8601, IsOptional, ValidateIf } from 'class-validator';

export class MarcarPagadaAsesoriaDto {
  /** Fecha contable del cobro (por defecto: ahora). */
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsISO8601()
  fechaPago?: string;
}
