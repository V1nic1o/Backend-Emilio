import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthServicio } from './auth.servicio';
import { AuthControlador } from './auth.controlador';
import { JwtEstrategia } from './jwt.estrategia';
import { PrismaModulo } from '../prisma/prisma.modulo';

@Module({
  imports: [
    PrismaModulo,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'secreto_cambiar_en_produccion',
      signOptions: { expiresIn: '90d' },
    }),
  ],
  controllers: [AuthControlador],
  providers: [AuthServicio, JwtEstrategia],
  exports: [JwtModule, JwtEstrategia],
})
export class AuthModulo {}
