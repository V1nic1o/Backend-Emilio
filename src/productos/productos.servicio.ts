import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoItem, TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { CloudinaryLogoServicio } from '../comunes/cloudinary-logo.servicio';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';

/**
 * Servicio de Productos.
 * Gestiona el catálogo de productos/servicios por wallet.
 * Los precios almacenados (proveedor y empresa) agilizán la creación de pedidos.
 */
@Injectable()
export class ProductosServicio {
  constructor(
    private readonly prisma: PrismaServicio,
    private readonly cloudinary: CloudinaryLogoServicio,
  ) {}

  /** Busca otro producto del mismo wallet con el mismo nombre (ignora mayúsculas/minúsculas). */
  private async buscarDuplicadoNombre(walletId: number, nombre: string, excluirId?: number) {
    const trimmed = nombre.trim();
    if (!trimmed) return null;
    return this.prisma.producto.findFirst({
      where: {
        walletId,
        nombre: { equals: trimmed, mode: 'insensitive' },
        ...(excluirId !== undefined ? { id: { not: excluirId } } : {}),
      },
    });
  }

  private async aplicarImagenProducto(
    productoId: number,
    walletId: number,
    imagenBase64: string | undefined,
    eliminarImagen: boolean | undefined,
    actual: { imagenUrl: string | null; imagenCloudinaryPublicId: string | null },
  ): Promise<{ imagenUrl: string | null; imagenCloudinaryPublicId: string | null }> {
    let imagenUrl = actual.imagenUrl;
    let imagenCloudinaryPublicId = actual.imagenCloudinaryPublicId;

    if (eliminarImagen === true) {
      if (imagenCloudinaryPublicId) {
        await this.cloudinary.eliminar(imagenCloudinaryPublicId);
      }
      return { imagenUrl: null, imagenCloudinaryPublicId: null };
    }

    const raw = imagenBase64?.trim();
    if (!raw) {
      return { imagenUrl, imagenCloudinaryPublicId };
    }

    if (!this.cloudinary.estaActivo()) {
      throw new BadRequestException(
        'Las fotos del catálogo requieren Cloudinary configurado en el servidor.',
      );
    }

    try {
      if (imagenCloudinaryPublicId) {
        await this.cloudinary.eliminar(imagenCloudinaryPublicId);
      }
      const subido = await this.cloudinary.subirImagenProducto(walletId, productoId, raw);
      return { imagenUrl: subido.secureUrl, imagenCloudinaryPublicId: subido.publicId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      throw new BadRequestException(`No se pudo subir la imagen: ${msg}`);
    }
  }

  /**
   * Si no existe un producto con el mismo nombre en el wallet, lo crea desde un ítem de pedido.
   * precioCompra/precioVenta del ítem → precioProveedor/precioEmpresa del catálogo.
   */
  async sincronizarDesdeItemPedidoIfNotExists(
    walletId: number,
    item: { nombre: string; tipo: TipoItem; precioCompra: number; precioVenta: number },
  ): Promise<{ creado: boolean; duplicado: boolean }> {
    const nombre = item.nombre.trim();
    if (!nombre || nombre.length > 150) {
      return { creado: false, duplicado: false };
    }
    const yaExiste = await this.buscarDuplicadoNombre(walletId, nombre);
    if (yaExiste) {
      return { creado: false, duplicado: true };
    }
    await this.prisma.producto.create({
      data: {
        walletId,
        nombre,
        tipo: item.tipo,
        precioProveedor: item.precioCompra,
        precioEmpresa: item.precioVenta,
      },
    });
    return { creado: true, duplicado: false };
  }

  async crear(datos: CrearProductoDto, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, datos.walletId, usuarioId, TipoWallet.empresa);
    const nombre = datos.nombre.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del producto no puede quedar vacío.');
    }
    const existente = await this.buscarDuplicadoNombre(datos.walletId, nombre);
    if (existente) {
      throw new ConflictException(
        `Ya existe un producto o servicio con el nombre «${existente.nombre}» en este catálogo.`,
      );
    }

    const producto = await this.prisma.producto.create({
      data: {
        walletId: datos.walletId,
        nombre,
        tipo: datos.tipo ?? 'bien',
        precioProveedor: datos.precioProveedor,
        precioEmpresa: datos.precioEmpresa,
      },
    });

    if (datos.imagenBase64?.trim()) {
      const img = await this.aplicarImagenProducto(
        producto.id,
        datos.walletId,
        datos.imagenBase64,
        false,
        { imagenUrl: null, imagenCloudinaryPublicId: null },
      );
      return this.prisma.producto.update({
        where: { id: producto.id },
        data: img,
      });
    }

    return producto;
  }

  async listarPorWallet(walletId: number, usuarioId: number) {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    return this.prisma.producto.findMany({
      where: { walletId },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerPorId(id: number, usuarioId: number) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    await assertWalletUsuarioYTipo(this.prisma, producto.walletId, usuarioId, TipoWallet.empresa);

    return producto;
  }

  async actualizar(id: number, datos: ActualizarProductoDto, usuarioId: number) {
    const actual = await this.obtenerPorId(id, usuarioId);

    if (datos.nombre !== undefined) {
      const nombre = datos.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre del producto no puede quedar vacío.');
      }
      const otro = await this.buscarDuplicadoNombre(actual.walletId, nombre, id);
      if (otro) {
        throw new ConflictException(
          `Ya existe otro producto o servicio con el nombre «${otro.nombre}» en este catálogo.`,
        );
      }
    }

    const img = await this.aplicarImagenProducto(
      id,
      actual.walletId,
      datos.imagenBase64,
      datos.eliminarImagen,
      {
        imagenUrl: actual.imagenUrl,
        imagenCloudinaryPublicId: actual.imagenCloudinaryPublicId,
      },
    );

    return this.prisma.producto.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined && { nombre: datos.nombre.trim() }),
        ...(datos.tipo !== undefined && { tipo: datos.tipo }),
        ...(datos.precioProveedor !== undefined && { precioProveedor: datos.precioProveedor }),
        ...(datos.precioEmpresa !== undefined && { precioEmpresa: datos.precioEmpresa }),
        imagenUrl: img.imagenUrl,
        imagenCloudinaryPublicId: img.imagenCloudinaryPublicId,
      },
    });
  }

  async eliminar(id: number, usuarioId: number) {
    const producto = await this.obtenerPorId(id, usuarioId);

    if (producto.imagenCloudinaryPublicId) {
      await this.cloudinary.eliminar(producto.imagenCloudinaryPublicId);
    }

    await this.prisma.producto.delete({ where: { id } });

    return { mensaje: 'Producto eliminado exitosamente' };
  }
}
