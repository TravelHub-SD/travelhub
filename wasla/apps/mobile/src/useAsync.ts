import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  reload: () => Promise<void>;
};

/**
 * جلب بيانات بسيط مع حالات التحميل والخطأ.
 * يتجاهل نتائج الطلبات القديمة حتى لا تكتب فوق أحدث نتيجة.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) {
        setError(err instanceof ApiError ? err.message : 'حدث خطأ غير متوقع');
      }
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, isLoading, reload: run };
}
