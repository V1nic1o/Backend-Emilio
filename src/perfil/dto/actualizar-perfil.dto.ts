import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarPerfilDto {
  @IsOptional() @IsString() @MaxLength(120) nombreEmpresa?: string;
  @IsOptional() @IsString() logoBase64?: string;
  /** Si es true, borra logo en Cloudinary y limpia logoUrl / logoBase64. */
  @IsOptional() @IsBoolean() eliminarLogo?: boolean;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
}
