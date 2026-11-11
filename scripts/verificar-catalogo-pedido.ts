/**
 * Prueba rápida local — DTO CrearItemDto y lógica guardarEnCatalogo.
 * Ejecutar: npx ts-node -r tsconfig-paths/register scripts/verificar-catalogo-pedido.ts
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearItemDto } from '../src/pedidos/items/dto/crear-item.dto';

const base = {
  tipo: 'bien' as const,
  nombre: 'Producto prueba',
  cantidad: 1,
  precioCompra: 100,
  precioVenta: 150,
};

async function validarDto(etiqueta: string, payload: Record<string, unknown>): Promise<boolean> {
  const dto = plainToInstance(CrearItemDto, payload);
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length > 0) {
    const msgs = errores.flatMap((e) => Object.values(e.constraints ?? {}));
    console.log(`  ✗ ${etiqueta}: ${msgs.join('; ')}`);
    return false;
  }
  console.log(`  ✓ ${etiqueta}`);
  return true;
}

function syncCatalogo(guardarEnCatalogo?: boolean): boolean {
  return guardarEnCatalogo === true;
}

async function main() {
  console.log('\n=== Validación CrearItemDto (como producción) ===\n');
  let ok = true;
  ok = (await validarDto('ítem sin guardarEnCatalogo', base)) && ok;
  ok = (await validarDto('guardarEnCatalogo: true', { ...base, guardarEnCatalogo: true })) && ok;
  ok = (await validarDto('guardarEnCatalogo: false', { ...base, guardarEnCatalogo: false })) && ok;
  ok = !(await validarDto('propiedad desconocida (debe fallar)', { ...base, campoExtra: 1 })) && ok;

  console.log('\n=== Lógica sincronizar catálogo (opt-in) ===\n');
  const casos = [
    { v: undefined, esperado: false },
    { v: false, esperado: false },
    { v: true, esperado: true },
  ];
  for (const c of casos) {
    const r = syncCatalogo(c.v);
    const pass = r === c.esperado;
    console.log(`  ${pass ? '✓' : '✗'} guardarEnCatalogo=${String(c.v)} → sync=${r}`);
    ok = pass && ok;
  }

  console.log(ok ? '\n✅ Todas las verificaciones OK\n' : '\n❌ Hay fallos\n');
  process.exit(ok ? 0 : 1);
}

void main();
