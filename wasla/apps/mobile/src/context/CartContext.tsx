import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiMenuItem } from '../api';

const CART_KEY = 'wasla.cart';

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type CartState = {
  storeSlug: string;
  storeName: string;
  deliveryFee: number;
  minOrder: number;
  lines: CartLine[];
};

type CartContextValue = {
  cart: CartState | null;
  itemCount: number;
  subtotal: number;
  isHydrated: boolean;
  /** يعيد false إذا رفض المستخدم استبدال سلة متجر آخر */
  addItem: (
    store: { slug: string; name: string; deliveryFee: number; minOrder: number },
    item: ApiMenuItem,
    quantity?: number
  ) => { ok: true } | { ok: false; conflictWith: string };
  replaceCartWith: (
    store: { slug: string; name: string; deliveryFee: number; minOrder: number },
    item: ApiMenuItem,
    quantity?: number
  ) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_KEY);
        if (raw) setCart(JSON.parse(raw) as CartState);
      } catch {
        // سلة تالفة في التخزين — نبدأ فارغين بدل تعطيل التطبيق
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // نحفظ فقط بعد الترطيب حتى لا نمسح السلة المخزّنة بالحالة الأولية
  useEffect(() => {
    if (!isHydrated) return;
    if (cart) AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => {});
    else AsyncStorage.removeItem(CART_KEY).catch(() => {});
  }, [cart, isHydrated]);

  const buildCart = useCallback(
    (
      store: { slug: string; name: string; deliveryFee: number; minOrder: number },
      item: ApiMenuItem,
      quantity: number
    ): CartState => ({
      storeSlug: store.slug,
      storeName: store.name,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
      lines: [{ menuItemId: item.id, name: item.name, price: item.price, quantity }],
    }),
    []
  );

  const addItem = useCallback<CartContextValue['addItem']>(
    (store, item, quantity = 1) => {
      // الطلب من متجر واحد فقط — كما في تطبيقات التوصيل المعتادة
      if (cart && cart.storeSlug !== store.slug) {
        return { ok: false, conflictWith: cart.storeName };
      }

      setCart((current) => {
        if (!current || current.storeSlug !== store.slug) return buildCart(store, item, quantity);

        const existing = current.lines.find((l) => l.menuItemId === item.id);
        const lines = existing
          ? current.lines.map((l) =>
              l.menuItemId === item.id ? { ...l, quantity: l.quantity + quantity } : l
            )
          : [...current.lines, { menuItemId: item.id, name: item.name, price: item.price, quantity }];

        return { ...current, lines };
      });

      return { ok: true };
    },
    [cart, buildCart]
  );

  const replaceCartWith = useCallback<CartContextValue['replaceCartWith']>(
    (store, item, quantity = 1) => {
      setCart(buildCart(store, item, quantity));
    },
    [buildCart]
  );

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setCart((current) => {
      if (!current) return current;
      const lines =
        quantity <= 0
          ? current.lines.filter((l) => l.menuItemId !== menuItemId)
          : current.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l));

      return lines.length ? { ...current, lines } : null;
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => setQuantity(menuItemId, 0), [setQuantity]);

  const clear = useCallback(() => setCart(null), []);

  const { itemCount, subtotal } = useMemo(() => {
    if (!cart) return { itemCount: 0, subtotal: 0 };
    return {
      itemCount: cart.lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: cart.lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    };
  }, [cart]);

  const value = useMemo(
    () => ({
      cart,
      itemCount,
      subtotal,
      isHydrated,
      addItem,
      replaceCartWith,
      setQuantity,
      removeItem,
      clear,
    }),
    [cart, itemCount, subtotal, isHydrated, addItem, replaceCartWith, setQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
