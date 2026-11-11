/**
 * Mensajes de error y éxito centralizados para toda la aplicación.
 */
export const MENSAJES = {
  PERSONA: {
    NO_ENCONTRADA: 'Persona no encontrada',
    CREADA: 'Persona creada exitosamente',
  },
  PEDIDO: {
    NO_ENCONTRADO: 'Pedido no encontrado',
    CREADO: 'Pedido creado exitosamente',
    ELIMINADO: 'Pedido eliminado exitosamente',
  },
  PAGO: {
    REGISTRADO: 'Pago registrado exitosamente',
    MONTO_INVALIDO: 'El monto del pago debe ser mayor a cero',
  },
  GASTO: {
    NO_ENCONTRADO: 'Gasto no encontrado',
    CREADO: 'Gasto creado exitosamente',
    ELIMINADO: 'Gasto eliminado exitosamente',
  },
  ASESORIA: {
    NO_ENCONTRADA: 'Asesoría no encontrada',
    COBRO_NO_ENCONTRADO: 'Cobro de asesoría no encontrado',
    YA_EXISTE: 'Este cliente ya tiene una asesoría registrada',
    SOLO_CLIENTE: 'La asesoría solo aplica a personas tipo cliente',
    WALLET_PERSONA: 'La persona no pertenece al wallet indicado',
    YA_PAGADA: 'Este cobro ya está marcado como pagado',
    CRON_NO_AUTORIZADO: 'No autorizado',
    SIN_CAMPOS_ACTUALIZAR: 'Indicá al menos monto mensual o IVA a actualizar',
    FECHA_PAGO_INVALIDA: 'La fecha de pago no es válida',
    ELIMINADA: 'Asesoría eliminada',
  },
} as const;
