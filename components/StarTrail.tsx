"use client";

import { useEffect, useRef } from "react";

const STAR_PATH =
  "M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z";

export default function StarTrail() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let last = 0;
    let active = 0;
    const MAX_ACTIVE = 80;

    const onMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - last < 55) return; // 限制频率，避免过度生成
      last = now;
      if (active >= MAX_ACTIVE) return;

      const star = document.createElement("div");
      star.className = "cursor-star";
      const size = 9 + Math.random() * 13;
      star.style.width = `${size.toFixed(1)}px`;
      star.style.height = `${size.toFixed(1)}px`;
      star.style.left = `${e.clientX}px`;
      star.style.top = `${e.clientY}px`;
      const dx = (Math.random() * 70 - 35).toFixed(1);
      const dy = (Math.random() * 55 - 45).toFixed(1);
      star.style.setProperty("--drift-x", `${dx}px`);
      star.style.setProperty("--drift-y", `${dy}px`);
      star.style.animationDuration = `${(0.6 + Math.random() * 0.55).toFixed(2)}s`;
      star.innerHTML = `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>`;
      layer.appendChild(star);
      active++;

      let removed = false;
      const remove = () => {
        if (removed) return;
        removed = true;
        star.remove();
        active--;
      };
      star.addEventListener("animationend", remove);
      // 兜底清理，防止动画异常导致元素堆积
      window.setTimeout(remove, 2200);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    />
  );
}
