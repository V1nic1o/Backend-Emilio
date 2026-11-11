import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModulo } from './prisma/prisma.modulo';
import { AuthModulo } from './auth/auth.modulo';
import { PerfilModulo } from './perfil/perfil.modulo';
import { WalletsModulo } from './wallets/wallets.modulo';
import { PersonasModulo } from './personas/personas.modulo';
import { ProductosModulo } from './productos/productos.modulo';
import { PedidosModulo } from './pedidos/pedidos.modulo';
import { GastosModulo } from './gastos/gastos.modulo';
import { EstadisticasModulo } from './estadisticas/estadisticas.modulo';
import { AsesoriasModulo } from './asesorias/asesorias.modulo';
import { FinanzasPersonalesModulo } from './finanzas-personales/finanzas-personales.modulo';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

/**
 * Módulo raíz de la aplicación.
 * JwtAuthGuard aplicado globalmente — todos los endpoints requieren token JWT
 * excepto los decorados con @Public() (p. ej. /auth/login, recuperación de contraseña).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModulo,
    AuthModulo,
    PerfilModulo,
    WalletsModulo,
    PersonasModulo,
    ProductosModulo,
    PedidosModulo,
    GastosModulo,
    EstadisticasModulo,
    AsesoriasModulo,
    FinanzasPersonalesModulo,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModulo {}
