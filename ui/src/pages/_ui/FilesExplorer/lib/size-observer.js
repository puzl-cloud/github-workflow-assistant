import { useEffect, useState } from "react";

export function useVirtuosoHeight(panelRef, config = {}) {
  const {
    minWidth = 1024, // applies the "dynamic space filler" only for wide screens
    responsiveMinHeight = [
      { max: 400, value: (vh) => vh * 0.8 }, // mobile
      { max: Infinity, value: 400 }, // default minHeight
    ],
  } = config;

  const [height, setHeight] = useState(null);

  useEffect(() => {
    const calculate = () => {
      const panelEl = panelRef.current;
      const rootEl = document.getElementById("root");

      if (!panelEl || !rootEl) {
        setHeight(null);
        return;
      }

      const width = window.innerWidth;
      const vh = window.innerHeight;

      const rule = responsiveMinHeight.find((r) => width <= r.max);
      const minHeight =
        typeof rule.value === "function" ? rule.value(vh) : rule.value;

      // If below minWidth, fallback to static responsive height
      if (width < minWidth) {
        setHeight(minHeight);
        return;
      }

      requestAnimationFrame(() => {
        const panelRect = panelEl.getBoundingClientRect();
        const panelTop = panelRect.top;
        const panelBottom = panelTop + panelRect.height;

        const rootHeight = rootEl.offsetHeight;
        const panelBottomAbsolute = panelBottom + window.scrollY;
        const distanceFromPanelBottomToRootBottom =
          rootHeight - panelBottomAbsolute;

        const available = Math.max(
          vh - panelTop - distanceFromPanelBottomToRootBottom,
          minHeight,
        );

        setHeight(Math.round(available));
      });
    };

    calculate();
    window.addEventListener("resize", calculate);
    return () => window.removeEventListener("resize", calculate);
  }, [panelRef, responsiveMinHeight, minWidth]);

  return height;
}
