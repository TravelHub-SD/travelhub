/** كل الأسعار تُخزَّن بالقرش (أصغر وحدة) — نحوّلها للعرض فقط */
export const CURRENCY = 'ج.س';

export function formatPrice(minorUnits: number): string {
  const major = minorUnits / 100;
  const rounded = Number.isInteger(major) ? major : Math.round(major * 100) / 100;
  return `${rounded.toLocaleString('ar-EG')} ${CURRENCY}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'بانتظار التأكيد',
  CONFIRMED: 'تم التأكيد',
  PREPARING: 'قيد التجهيز',
  ON_THE_WAY: 'في الطريق',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغى',
};

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'نقداً عند الاستلام',
  CARD: 'بطاقة بنكية',
  WALLET: 'محفظة إلكترونية',
};
