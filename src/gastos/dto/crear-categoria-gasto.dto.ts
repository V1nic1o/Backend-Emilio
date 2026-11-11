import { IsInt, IsNotEmpty, IsPositive, IsString, MaxLength } from 'class-validator';

export class CrearCategoriaGastoDto {
  @IsInt({ message: 'El walletId debe ser un entero' })
  @IsPositive({ message: 'El walletId debe ser positivo' })
  walletId: number;

  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(50, { message: 'El nombre no puede superar 50 caracteres' })
  nombre: string;
}
