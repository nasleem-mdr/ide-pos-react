import { useEffect, useRef, useCallback } from 'react';

/**
 * useInfiniteScroll
 * @param {function} fetchMore
 * @param {boolean} hasMore
 * @param {boolean} loading
 * @param {string} rootMargin
 * @param {React.RefObject} rootRef - ref ke container yang benar-benar scroll.
 *        Kosongkan (undefined/null) kalau yang scroll adalah window/document.
 */
export function useInfiniteScroll({ fetchMore, hasMore, loading, rootMargin = '300px', rootRef = null }) {
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
      root: rootRef?.current ?? null, // <- pakai container scroll yang sebenarnya
      rootMargin,
      threshold: 0,
    });

    const node = sentinelRef.current;
    if (node) observerRef.current.observe(node);

    return () => observerRef.current?.disconnect();
  }, [handleIntersect, rootMargin, rootRef?.current]); // re-attach kalau root berubah

  return sentinelRef;
}