import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ApiUser = { id: string; name: string; phone: string; email: string | null };

export type ApiCategory = { id: string; name: string; slug: string; icon: string; storeCount: number };

export type ApiStore = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  logoUrl: string;
  area: string;
  rating: number;
  ratingCount: number;
  deliveryFee: number;
  minOrder: number;
  etaMinutes: number;
  isOpen: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string } | null;
};

export type ApiMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isPopular: boolean;
};

export type ApiPopularItem = ApiMenuItem & { storeName: string; storeSlug: string };

export type ApiStoreDetail = ApiStore & {
  sections: { id: string; name: string; items: ApiMenuItem[] }[];
};

export type ApiAddress = {
  id: string;
  label: string;
  area: string;
  city: string;
  details: string;
  isDefault: boolean;
};

export type ApiOrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

export type ApiOrderEvent = { id: string; status: string; message: string; createdAt: string };

export type ApiOrder = {
  id: string;
  code: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  note: string;
  addressSnapshot: string;
  etaMinutes: number;
  createdAt: string;
  store: { name: string; slug: string; logoUrl: string };
  items: ApiOrderItem[];
  events?: ApiOrderEvent[];
  review?: { rating: number; comment: string } | null;
};

/** خطأ قادم من السيرفر يحمل رسالة عربية جاهزة للعرض */
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * على جهاز حقيقي، localhost يشير إلى الجوال نفسه — نستنتج عنوان جهاز التطوير
 * من مضيف Metro حتى يعمل التطبيق دون تعديل يدوي.
 */
function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  const port = configured?.split(':').pop() || '4000';

  if (Platform.OS === 'web') return configured || `http://localhost:${port}`;

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).expoGoConfig?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : null;
  if (host) return `http://${host}:${port}`;

  return configured || `http://localhost:${port}`;
}

export const API_BASE_URL = resolveBaseUrl();

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('تعذّر الاتصال بالسيرفر. تأكد من اتصالك بالإنترنت', 'NETWORK_ERROR', 0);
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const err = body?.error ?? {};
    throw new ApiError(err.message || 'حدث خطأ غير متوقع', err.code || 'UNKNOWN', response.status);
  }

  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = {
  register: (data: { name: string; phone: string; password: string; email?: string }) =>
    post<{ token: string; user: ApiUser }>('/api/auth/register', data),

  login: (data: { phone: string; password: string }) =>
    post<{ token: string; user: ApiUser }>('/api/auth/login', data),

  me: () => get<{ user: ApiUser }>('/api/auth/me'),

  updateProfile: (data: { name?: string; email?: string }) =>
    patch<{ user: ApiUser }>('/api/auth/me', data),

  categories: () => get<{ categories: ApiCategory[] }>('/api/categories'),

  stores: (params: { category?: string; q?: string; featured?: boolean } = {}) => {
    const search = new URLSearchParams();
    if (params.category) search.set('category', params.category);
    if (params.q) search.set('q', params.q);
    if (params.featured) search.set('featured', 'true');
    const qs = search.toString();
    return get<{ stores: ApiStore[] }>(`/api/stores${qs ? `?${qs}` : ''}`);
  },

  store: (slug: string) => get<{ store: ApiStoreDetail }>(`/api/stores/${slug}`),

  popularItems: () => get<{ items: ApiPopularItem[] }>('/api/popular-items'),

  addresses: () => get<{ addresses: ApiAddress[] }>('/api/addresses'),

  createAddress: (data: {
    label: string;
    area: string;
    city?: string;
    details: string;
    isDefault?: boolean;
  }) => post<{ address: ApiAddress }>('/api/addresses', data),

  deleteAddress: (id: string) => del<{ ok: boolean }>(`/api/addresses/${id}`),

  setDefaultAddress: (id: string) =>
    patch<{ address: ApiAddress }>(`/api/addresses/${id}`, { isDefault: true }),

  createOrder: (data: {
    storeSlug: string;
    addressId: string;
    paymentMethod: string;
    note?: string;
    items: { menuItemId: string; quantity: number; note?: string }[];
  }) => post<{ order: ApiOrder }>('/api/orders', data),

  orders: () => get<{ orders: ApiOrder[] }>('/api/orders'),

  order: (id: string) => get<{ order: ApiOrder }>(`/api/orders/${id}`),

  cancelOrder: (id: string) => post<{ order: ApiOrder }>(`/api/orders/${id}/cancel`),

  advanceOrder: (id: string) => post<{ order: ApiOrder }>(`/api/orders/${id}/advance`),

  reviewOrder: (id: string, data: { rating: number; comment?: string }) =>
    post<{ review: { rating: number; comment: string } }>(`/api/orders/${id}/review`, data),
};
