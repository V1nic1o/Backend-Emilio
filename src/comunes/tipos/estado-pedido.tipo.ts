/**
 * Estados posibles de un pedido.
 * Se calculan dinámicamente, nunca se persisten en la base de datos.
 */
export type EstadoPedido = 'pendiente' | 'parcial' | 'pagado';
