import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * useFloatingBarPadding
 *
 * Dynamically measures a floating/fixed bottom action bar and returns a
 * `paddingBottom` CSS value to apply to the scrollable content above it,
 * ensuring the last content row is never hidden behind the bar.
 *
 * Usage:
 *   const { barRef, contentPaddingBottom } = useFloatingBarPadding({ visible: isBarVisible });
 *
 *   // Apply to the scrollable content container:
 *   <div style={{ paddingBottom: contentPaddingBottom }}>…rows…</div>
 *
 *   // Attach to the floating bar element:
 *   <div ref={barRef} className="fixed bottom-0 …">…</div>
 */
interface UseFloatingBarPaddingOptions {
  /** Whether the floating bar is currently rendered/visible */
  visible: boolean;
  /**
   * Extra gap (px) between the bar top and the last content item.
   * Defaults to 16px (1rem).
   */
  gap?: number;
}

interface UseFloatingBarPaddingResult {
  /** Attach this ref to the floating bar DOM element */
  barRef: React.RefObject<HTMLDivElement>;
  /**
   * Apply this as `style={{ paddingBottom: contentPaddingBottom }}`
   * on the scrollable content wrapper.
   */
  contentPaddingBottom: string;
}

export function useFloatingBarPadding({
  visible,
  gap = 16,
}: UseFloatingBarPaddingOptions): UseFloatingBarPaddingResult {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  const updateHeight = useCallback(() => {
    if (!visible || !barRef.current) {
      setBarHeight(0);
      return;
    }
    setBarHeight(barRef.current.getBoundingClientRect().height);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setBarHeight(0);
      return;
    }

    // Initial measurement
    updateHeight();

    const el = barRef.current;
    if (!el) return;

    // Watch for size changes (font scaling, wrapping, etc.)
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);

    return () => observer.disconnect();
  }, [visible, updateHeight]);

  const contentPaddingBottom =
    visible && barHeight > 0 ? `${barHeight + gap}px` : '0px';

  return { barRef: barRef as unknown as React.RefObject<HTMLDivElement>, contentPaddingBottom };
}
