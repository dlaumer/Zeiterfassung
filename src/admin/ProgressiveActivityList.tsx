import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const PAGE_SIZE = 50;

/** Receives the complete filtered history; only rendering is paginated. */
export function ProgressiveActivityList<T>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  const [page, setPage] = useState({ items, count: PAGE_SIZE });
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Reset synchronously so a new filter never renders the previous large page.
  const count = page.items === items ? page.count : PAGE_SIZE;
  const hasMore = count < items.length;

  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0;
  }, [items]);

  useEffect(() => {
    const root = rootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      // One batch per observation; reattach after React renders the new batch.
      observer.disconnect();
      setPage({ items, count: Math.min(count + PAGE_SIZE, items.length) });
    }, { root, rootMargin: '0px 0px 200px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items, count, hasMore]);

  return (
    <div ref={rootRef} className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
      {items.slice(0, count).map(renderItem)}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
    </div>
  );
}
