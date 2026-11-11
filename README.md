# Backend — Tikb'al

API REST para la gestión de pedidos, clientes, proveedores, pagos y gastos.

**Desarrollado por:** Vinicio Valdez  
**Tecnología:** NestJS + Prisma + PostgreSQL (Neon)  
**Desplegado en:** Google Cloud Run  
**URL producción:** `https://pedidos-backend-4jbtgazerq-uc.a.run.app/api`

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| NestJS | Framework principal de la API |
| Prisma | ORM para base de datos |
| PostgreSQL (Neon) | Base de datos en la nube |
| TypeScript | Lenguaje principal |
| class-validator | Validación de DTOs |
| Docker | Contenerización para Cloud Run |

---

## Estructura del proyecto

```
src/
├── app.modulo.ts              # Módulo raíz — registra todos los módulos
├── main.ts                    # Punto de entrada — configura CORS, validación y puerto
│
├── prisma/
│   ├── prisma.modulo.ts       # Módulo de Prisma (global)
│   └── prisma.servicio.ts     # Servicio que gestiona la conexión a la BD
│
├── personas/
│   ├── personas.modulo.ts
│   ├── personas.controlador.ts   # GET /personas, POST, GET /:id, DELETE /:id
│   ├── personas.servicio.ts      # Lógica de negocio de personas
│   └── dto/
│       └── crear-persona.dto.ts  # Validación: nombre, tipo (cliente|proveedor)
│
├── pedidos/
│   ├── pedidos.modulo.ts
│   ├── pedidos.controlador.ts    # CRUD de pedidos + registrar pago
│   ├── pedidos.servicio.ts       # Lógica: calcular totales, estados, pagos
│   ├── dto/
│   │   └── crear-pedido.dto.ts   # Validación: personaId, tipo, items, pagoInicial
│   ├── items/dto/
│   │   └── crear-item.dto.ts
│   └── pagos/dto/
│       └── crear-pago.dto.ts
│
├── gastos/
│   ├── gastos.modulo.ts
│   ├── gastos.controlador.ts     # CRUD de gastos
│   ├── gastos.servicio.ts
│   └── dto/
│       └── crear-gasto.dto.ts    # Validación: descripcion, monto, categoria
│
├── estadisticas/
│   ├── estadisticas.modulo.ts
│   ├── estadisticas.controlador.ts  # GET /estadisticas
│   └── estadisticas.servicio.ts     # Calcula ganancia neta, histórico 6 meses
│
└── comunes/
    ├── utilidades/
    │   └── calculadora-pedido.util.ts  # Calcula totales, saldo, estado de pedido
    ├── tipos/
    │   └── resumen-pedido.tipo.ts      # Tipos compartidos: ResumenPedido
    └── constantes/
        └── mensajes.constante.ts       # Mensajes de error reutilizables
```

---

## Endpoints

### Personas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/personas` | Lista todas las personas |
| GET | `/api/personas/:id` | Detalle de una persona con sus pedidos |
| POST | `/api/personas` | Crear persona |
| DELETE | `/api/personas/:id` | Eliminar persona (elimina sus pedidos en cascada) |

### Pedidos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/pedidos` | Lista todos los pedidos con resumen calculado |
| GET | `/api/pedidos/:id` | Detalle de un pedido |
| POST | `/api/pedidos` | Crear pedido con ítems y pago inicial opcional |
| DELETE | `/api/pedidos/:id` | Eliminar pedido |
| POST | `/api/pedidos/:id/pagos` | Registrar un pago (valida que no exceda el saldo) |

### Gastos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/gastos` | Lista todos los gastos |
| POST | `/api/gastos` | Crear gasto |
| DELETE | `/api/gastos/:id` | Eliminar gasto |

### Estadísticas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/estadisticas` | Ganancia neta, ingresos, costos, gastos e histórico 6 meses |

---

## Lógica de negocio importante

### Cálculo de resumen de pedido
Cada pedido devuelve campos calculados (no almacenados en BD):
- `totalCompra` — suma de `precioCompra × cantidad` de cada ítem
- `totalVenta` — suma de `precioVenta × cantidad` de cada ítem
- `totalPagado` — suma de todos los pagos registrados
- `saldoPendiente` — totalReferencia − totalPagado
- `estado` — `pendiente` | `parcial` | `pagado`

> **Regla:** Para pedidos de tipo `venta`, el `saldoPendiente` se calcula sobre `totalVenta`. Para pedidos de tipo `compra`, se calcula sobre `totalCompra`.

### Validaciones en pagos
- No se puede registrar un pago si el pedido ya está en estado `pagado`
- El monto del pago no puede superar el `saldoPendiente`

### Cálculo de estadísticas
- `totalIngresos` = suma de `totalVenta` de pedidos tipo `venta`
- `totalCostoVentas` = suma de `totalCompra` de esos mismos pedidos
- `gananciaBruta` = totalIngresos − totalCostoVentas
- `totalGastos` = suma de todos los gastos registrados
- `gananciaNeta` = gananciaBruta − totalGastos

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión PostgreSQL (Neon) |
| `PORT` | Puerto del servidor (Cloud Run lo inyecta automáticamente) |

---

## Correr en desarrollo

```bash
# Instalar dependencias
npm install

# Correr en modo desarrollo
npm run start:dev

# Compilar para producción
npm run build
```

---

## Deploy a Cloud Run

```bash
# Desde la carpeta backend/
bash deploy.sh
```

El script crea el proyecto GCP, vincula facturación, habilita APIs, construye la imagen Docker y despliega automáticamente.

---

## Agregar nuevas funcionalidades

Para agregar un nuevo módulo (ej: `Categorias`):

1. Crear carpeta `src/categorias/`
2. Crear `categorias.modulo.ts`, `categorias.servicio.ts`, `categorias.controlador.ts`
3. Crear `dto/crear-categoria.dto.ts` con validaciones
4. Importar el módulo en `app.modulo.ts`
5. Agregar el modelo en `prisma/schema.prisma` y ejecutar `npx prisma migrate dev`

---

## Schema de base de datos

```
Persona (id, nombre, tipo: cliente|proveedor)
  └── Pedido (id, personaId, tipo: compra|venta, fecha)
        ├── ItemPedido (id, pedidoId, tipo: bien|servicio, nombre, cantidad, precioCompra, precioVenta)
        └── Pago (id, pedidoId, monto, fecha)

Gasto (id, descripcion, monto, fecha, categoria?)
```
