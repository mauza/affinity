"use client";

import { useEffect, useState, type RefObject } from "react";

export function useReplayMotion(ref: RefObject<HTMLElement | null>, enabled = true) {
  const [visible, setVisible] = useState(true), [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = enabled;
    const updateVisibility = () => setVisible(inView && document.visibilityState !== "hidden");
    const updatePreference = () => setReducedMotion(preference.matches);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateVisibility(); });
    if (enabled && ref.current) observer.observe(ref.current);
    updateVisibility(); updatePreference();
    document.addEventListener("visibilitychange", updateVisibility);
    preference.addEventListener("change", updatePreference);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", updateVisibility); preference.removeEventListener("change", updatePreference); };
  }, [ref, enabled]);
  return { visible, reducedMotion };
}
