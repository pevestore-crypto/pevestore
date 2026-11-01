/**
 * Estados del pedido y transiciones permitidas. La base de datos aplica la
 * misma regla (función order_transition_allowed) para que nadie se la salte.
 */
export const ORDER_STATUSES = [
  "pending_payment",
  "payment_review",
  "confirmed",
  "pending_design",
  "in_production",
  "ready_for_pickup",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  payment_review: "Pago por verificar",
  confirmed: "Confirmado",
  pending_design: "Pendiente de diseño",
  in_production: "En producción",
  ready_for_pickup: "Listo para retirar",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

/** Tono visual del estado (se traduce a tokens del sistema de diseño). */
export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  pending_payment: "neutral",
  payment_review: "warning",
  confirmed: "success",
  pending_design: "warning",
  in_production: "info",
  ready_for_pickup: "success",
  delivered: "success",
  cancelled: "danger",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["payment_review", "cancelled"],
  // Si el comprobante no es válido, vuelve a pendiente de pago.
  payment_review: ["confirmed", "pending_payment", "cancelled"],
  confirmed: ["pending_design", "in_production", "cancelled"],
  pending_design: ["in_production", "cancelled"],
  in_production: ["ready_for_pickup", "pending_design", "cancelled"],
  ready_for_pickup: ["delivered", "in_production"],
  delivered: [],
  cancelled: [],
};

export function allowedNextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Estados en que el negocio ya aceptó el pedido (pago verificado). */
export function isConfirmedStatus(status: OrderStatus): boolean {
  return ["confirmed", "pending_design", "in_production", "ready_for_pickup", "delivered"].includes(status);
}

/** Exportado para generar el SQL equivalente y verificar que coinciden. */
export const ORDER_TRANSITIONS = TRANSITIONS;
