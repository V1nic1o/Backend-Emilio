# Criterios de estadísticas (workspace empresa)

Zona horaria de agrupación mensual: **`America/Guatemala`**.

## Modos de negocio (`modoPedidoNegocio`)

Solo aplica a **`tipo = venta`**. Si `tipo = compra`, `modoPedidoNegocio` devuelve **`null`**; las compras históricas siguen tratándose en la rama de compras del servicio de estadísticas.

| Modo | Cómo se detecta | Lógica en `estadisticas-venta-por-modo.util` |
|------|-----------------|---------------------------------------------|
| `venta_cliente` | venta, `esIntermediacion = false`, con `personaId` | `metricasVentaClienteEnMes` |
| `venta_proveedor` | venta y (`esIntermediacion = true` **o** sin `personaId` con `proveedorId`) | Si intermediación: `metricasVentaProveedorEnMes`. Si no (legado sin cliente en app): `metricasVentaSinClienteLegacyEnMes` |

## Ingresos mensuales (`porMes[].ingresos`)

- **Venta cliente:** suma de `Pago` (cliente → empresa) en el mes.
- **Venta proveedor (intermediación):** **solo** `PagoProveedor` `pago`/`cobro` (reparto a la empresa). No `Pago` del pedido.
- **Venta proveedor sin cliente en app (legado):** `PagoProveedor` tipo `ingreso_cliente_a_proveedor` en el mes.
- **Asesorías:** cobros con `estado = pagada` y `fechaPago` en el mes.

## Costo mensual (`porMes[].costoVentas`)

- **Ventas (cliente → empresa, sin proveedor vinculado):** `totalCompra` prorrateado según cobros del cliente en el mes.
- **Venta cliente + proveedor de costo** (`esIntermediacion = false`, cliente y `proveedorId`): ingreso = cobros del cliente en el mes; costo = **pagos al proveedor en el mes** (`pago` − `cobro`), no prorrateo de catálogo al cobrar.
- **Intermediación:** sin costo de catálogo en la empresa (el proveedor asume el costo); solo ingresa el **reparto** cobrado en el mes.
- **Venta proveedor sin cliente (legado):** no se imputa costo de catálogo por cobros del cliente; tampoco por `ingreso_cliente_a_proveedor`.
- **Compras:** `totalCompra` prorrateado según `Pago` del pedido en el mes.

## IVA mensual (`porMes[].impuestosIva`)

IVA de ventas prorrateado con los mismos ratios que el costo, más IVA de asesorías cobradas en el mes.

## Gastos (`porMes[].gastos`)

Suma de registros del módulo **Gastos** con `fecha` en el mes (misma zona).

## Totales del `GET /estadisticas`

Se calculan **acumulando todos los meses** desde el primer movimiento detectado hasta el mes actual en la zona, usando la misma función que cada `porMes`. Así, `totalIngresos`, `totalCostoVentas`, `totalImpuestosIva`, `totalGastos`, `gananciaBruta` y `gananciaNeta` son **coherentes** con la suma de la serie mensual (salvo redondeos por mes).

## `GET /estadisticas/rango`

Las fechas `desde` y `hasta` deben ser **`YYYY-MM-DD`**. Se interpretan como **calendario de mes** (día 1 de cada mes) entre el mes de `desde` y el de `hasta`, inclusive.

## Verificación automática (sin base de datos)

```bash
npm run test:estadisticas
```

Ejecuta `src/estadisticas/ejecutar-verificacion-estadisticas.ts`: zona horaria, venta con cobro parcial, intermediación (solo proveedor y mixta con cliente), venta sin cliente con `ingreso_cliente_a_proveedor`, compras y suma en dos meses.
