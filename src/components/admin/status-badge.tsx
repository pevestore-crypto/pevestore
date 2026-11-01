import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from "@/lib/domain/order-status";

export const toneClass = {
  neutral: "bg-surface text-foreground",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  danger: "bg-brand-soft text-danger",
} as const;

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[ORDER_STATUS_TONE[status]]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
