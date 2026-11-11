import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Subida de logos de empresa a Cloudinary (opcional).
 * Si faltan variables de entorno, `estaActivo()` es false y el perfil sigue usando solo `logoBase64`.
 */
@Injectable()
export class CloudinaryLogoServicio {
  private readonly logger = new Logger(CloudinaryLogoServicio.name);
  private readonly activo: boolean;

  constructor(private readonly config: ConfigService) {
    const cloud_name = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const api_key = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const api_secret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    this.activo = !!(cloud_name && api_key && api_secret);
    if (this.activo) {
      cloudinary.config({ cloud_name, api_key, api_secret });
    } else {
      this.logger.log(
        'Cloudinary no configurado (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET). Logos solo en base64.',
      );
    }
  }

  estaActivo(): boolean {
    return this.activo;
  }

  /** Logo por workspace empresa (evita colisión entre varios negocios del mismo usuario). */
  async subirLogoWallet(walletId: number, dataUri: string): Promise<{ secureUrl: string; publicId: string }> {
    if (!this.activo) {
      throw new Error('Cloudinary no está configurado');
    }
    const publicId = `pedidos_gt/wallets/${walletId}/logo`;
    const esPng = /^data:image\/png/i.test(dataUri.trim());
    /** `limit` escala si excede el tamaño sin recortar. PNG mantiene transparencia (evitar `f_auto`→JPEG que la pinta negra en PDF). */
    const transformation = esPng
      ? [{ width: 1200, height: 1200, crop: 'limit' as const }, { fetch_format: 'png' as const }]
      : [{ width: 1200, height: 1200, crop: 'limit' as const }, { fetch_format: 'auto' as const, quality: 'auto' as const }];
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      transformation,
    });
    return { secureUrl: result.secure_url, publicId: result.public_id };
  }

  /** Foto de producto/servicio en catálogo (thumbnails para app y PDF). */
  async subirImagenProducto(
    walletId: number,
    productoId: number,
    dataUri: string,
  ): Promise<{ secureUrl: string; publicId: string }> {
    if (!this.activo) {
      throw new Error('Cloudinary no está configurado');
    }
    const publicId = `pedidos_gt/wallets/${walletId}/productos/${productoId}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit' as const },
        { fetch_format: 'auto' as const, quality: 'auto' as const },
      ],
    });
    return { secureUrl: result.secure_url, publicId: result.public_id };
  }

  /** URL optimizada para PDF / listas (menor peso). */
  urlImagenProductoPdf(secureUrl: string): string {
    if (!this.activo || !secureUrl?.trim()) return secureUrl;
    try {
      const u = new URL(secureUrl.trim());
      if (!u.hostname.includes('res.cloudinary.com')) return secureUrl;
      const parts = u.pathname.split('/upload/');
      if (parts.length < 2) return secureUrl;
      return `${u.origin}/upload/c_limit,w_280,h_280,f_auto,q_auto/${parts[1]}`;
    } catch {
      return secureUrl;
    }
  }

  async eliminar(publicId: string): Promise<void> {
    if (!this.activo || !publicId?.trim()) return;
    try {
      await cloudinary.uploader.destroy(publicId.trim(), { resource_type: 'image' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Cloudinary destroy falló (${publicId}): ${msg}`);
    }
  }
}
