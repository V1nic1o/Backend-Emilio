import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModulo } from './app.modulo';

async function iniciar() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET debe estar definido en producción');
  }

  const app = await NestFactory.create(AppModulo);

  // Aumentar límite del body para soportar logos en base64 (hasta 10MB)
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

  // Pipe global de validación: transforma y valida todos los DTOs automáticamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si llegan propiedades extra
      transform: true,        // Convierte tipos automáticamente (string → number, etc.)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Prefijo global para todos los endpoints
  app.setGlobalPrefix('api');

  // CORS: móvil no usa Origin; en web (Expo localhost, Vercel) sí. Si CORS_ORIGINS tiene lista
  // explícita, sumamos localhost típico de Expo/React para que desarrollo web no falle.
  const desdeEnv = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const extrasLocalhostWeb = [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8082',
    'http://127.0.0.1:8082',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
  ];
  const origenesCorsPermitidos =
    desdeEnv.length > 0 ? [...new Set([...desdeEnv, ...extrasLocalhostWeb])] : null;

  app.enableCors({
    origin: origenesCorsPermitidos ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  });

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto);

  console.log(`🚀 Servidor corriendo en: http://localhost:${puerto}/api`);
}

iniciar();
