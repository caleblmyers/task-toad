import { useEffect, useRef, useState } from 'react';

export function useResizableContainer(defaultWidth = 500): [number, React.RefObject<HTMLDivElement>] {
  const [width, setWidth] = useState(defaultWidth);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [width, ref];
}
