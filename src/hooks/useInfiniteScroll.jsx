import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useInfiniteScroll
 * @param {function} fetchMore - fungsi async yang fetch halaman berikutnya
 * @param {boolean} hasMore - apakah masih ada data selanjutnya
 * @param {boolean} loading - status loading saat ini (biar tidak double-fetch)
 * @param {string} rootMargin - jarak trigger sebelum sentinel benar-benar terlihat
 */
export function useInfiniteScroll({ fetchMore, hasMore, loading, rootMargin = '300px' }) {
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const handleIntersect = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loading) {
      fetchMore();
    }
  }, [fetchMore, hasMore, loading]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root: null, // viewport (atau ganti ke ref container scroll kalau perlu)
      rootMargin,
      threshold: 0,
    });

    const node = sentinelRef.current;
    if (node) observerRef.current.observe(node);

    return () => observerRef.current?.disconnect();
  }, [handleIntersect, rootMargin]);

  return sentinelRef;
}
