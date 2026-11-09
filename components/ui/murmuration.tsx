"use client";
// The Discover hero: a murmuration. Every particle is an attendee coloured by
// interest. Separation keeps everyone apart, but alignment and cohesion only
// act between people who share an interest, so pods form, drift and pass
// through each other, which is the whole product in one picture. The pointer
// gently gathers nearby particles. Pauses offscreen; with reduced motion it
// draws one settled frame.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import s from "./attendee.module.css";

const PODS = [
  { label: "Platform", rgb: [94, 234, 212] },
  { label: "AI", rgb: [167, 139, 250] },
  { label: "Security", rgb: [244, 114, 182] },
  { label: "Observability", rgb: [251, 191, 36] },
  { label: "Networking", rgb: [96, 165, 250] },
  { label: "Storage", rgb: [134, 239, 172] },
] as const;

type P = { x: number; y: number; vx: number; vy: number; g: number };

export default function Murmuration({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const syncPlayback = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const labelCanvas = labelRef.current;
    const labelCtx = labelCanvas?.getContext("2d");
    if (!canvas || !ctx || !labelCanvas || !labelCtx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    pauseRef.current = motion.matches;
    setPaused(motion.matches);
    let w = 0, h = 0, t = 0, raf = 0, visible = true;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ps: P[] = [];
    const labels = PODS.map(() => ({ x: 0, y: 0, a: 0 }));
    const pointer = { x: 0, y: 0, on: false };

    function resize() {
      const r = canvas!.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const oldW = w, oldH = h;
      w = r.width; h = r.height;
      for (const p of ps) { p.x *= w / oldW; p.y *= h / oldH; }
      for (const layer of [canvas!, labelCanvas!]) { layer.width = Math.round(w * dpr); layer.height = Math.round(h * dpr); }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      labelCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(340, Math.max(110, (w * h) / 2300)));
      while (ps.length < n) {
        const g = Math.floor(rnd() * PODS.length), hm = home(g);
        ps.push({ x: hm.x + (rnd() - 0.5) * w * 0.2, y: hm.y + (rnd() - 0.5) * h * 0.25, vx: rnd() * 2 - 1, vy: rnd() * 2 - 1, g });
      }
      ps.length = n;
      for (const l of labels) l.a = 0;
    }

    // Each pod has a home that wanders on its own slow Lissajous path.
    const home = (g: number) => {
      const a = t * 0.0021 + g * 1.9;
      return { x: w * (0.5 + 0.36 * Math.cos(a * 0.7 + g)), y: h * (0.5 + 0.32 * Math.sin(a * 1.1 + g * 2.3)) };
    };

    function step() {
      t++;
      const homes = PODS.map((_, g) => home(g));
      for (const p of ps) {
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
        for (const q of ps) {
          if (q === p) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 196) { sx -= dx / (d2 + 1); sy -= dy / (d2 + 1); }
          if (q.g === p.g && d2 < 5600) { ax += q.vx; ay += q.vy; cx += q.x; cy += q.y; n++; }
        }
        let fx = sx * 1.6, fy = sy * 1.6;
        if (n) { fx += (ax / n - p.vx) * 0.06 + (cx / n - p.x) * 0.0011; fy += (ay / n - p.vy) * 0.06 + (cy / n - p.y) * 0.0011; }
        const hm = homes[p.g];
        fx += (hm.x - p.x) * 0.00045; fy += (hm.y - p.y) * 0.00045;
        if (pointer.on) {
          const dx = pointer.x - p.x, dy = pointer.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) { fx += dx * 0.0016; fy += dy * 0.0016; }
        }
        p.vx = (p.vx + fx) * 0.985; p.vy = (p.vy + fy) * 0.985;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 2.1) { p.vx *= 2.1 / sp; p.vy *= 2.1 / sp; } else if (sp > 0 && sp < 0.55) { p.vx *= 0.55 / sp; p.vy *= 0.55 / sp; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -24) p.x = w + 24; else if (p.x > w + 24) p.x = -24;
        if (p.y < -24) p.y = h + 24; else if (p.y > h + 24) p.y = -24;
      }
    }

    function draw(fade: boolean) {
      // Fade the previous frame toward transparent so the CSS backdrop shows and motion leaves trails.
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.fillStyle = fade ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,1)";
      ctx!.fillRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineWidth = 0.7;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i], [r, g, b] = PODS[p.g].rgb;
        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j];
          if (q.g !== p.g) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 1100) {
            ctx!.strokeStyle = `rgba(${r},${g},${b},${0.28 * (1 - d2 / 1100)})`;
            ctx!.beginPath(); ctx!.moveTo(p.x, p.y); ctx!.lineTo(q.x, q.y); ctx!.stroke();
          }
        }
      }
      for (const p of ps) {
        const [r, g, b] = PODS[p.g].rgb;
        ctx!.fillStyle = `rgba(${r},${g},${b},0.95)`;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx!.fill();
      }
      // Labels get a clean layer so only particles leave trails.
      labelCtx!.clearRect(0, 0, w, h);
      labelCtx!.font = "600 11px system-ui, sans-serif";
      labelCtx!.textAlign = "center";
      PODS.forEach((pod, g) => {
        const hm = home(g);
        let x = 0, y = 0, n = 0;
        for (const p of ps) if (p.g === g && (p.x - hm.x) ** 2 + (p.y - hm.y) ** 2 < 26000) { x += p.x; y += p.y; n++; }
        const l = labels[g];
        if (n >= 8) {
          x /= n; y /= n;
          if (!l.a) { l.x = x; l.y = y; }
          l.x += (x - l.x) * 0.06; l.y += (y - l.y) * 0.06; l.a = Math.min(1, l.a + (fade ? 0.02 : 1));
        } else l.a = Math.max(0, l.a - 0.02);
        if (l.a < 0.05) return;
        const [r, gg, b] = pod.rgb;
        labelCtx!.fillStyle = `rgba(${r},${gg},${b},${0.85 * l.a})`;
        labelCtx!.fillText(pod.label.toUpperCase(), Math.max(48, Math.min(w - 48, l.x)), Math.max(20, l.y - 30));
      });
    }

    const frame = () => {
      raf = 0;
      if (visible && !document.hidden && !pauseRef.current) { step(); draw(true); raf = requestAnimationFrame(frame); }
    };
    const sync = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (visible && !document.hidden && !pauseRef.current) raf = requestAnimationFrame(frame);
    };
    syncPlayback.current = sync;
    resize();
    draw(false);
    sync();

    const ro = new ResizeObserver(() => { resize(); draw(false); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
    io.observe(canvas);
    const preference = () => { pauseRef.current = motion.matches; setPaused(motion.matches); sync(); };
    motion.addEventListener("change", preference);
    document.addEventListener("visibilitychange", sync);
    const host = canvas.parentElement ?? canvas;
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true; };
    const leave = () => { pointer.on = false; };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); motion.removeEventListener("change", preference); document.removeEventListener("visibilitychange", sync); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); syncPlayback.current = () => {}; };
  }, []);
  return <>
    <canvas ref={ref} className={className} aria-hidden="true" />
    <canvas ref={labelRef} className={`${className ?? ""} ${s.heroLabels}`} aria-hidden="true" />
    <button type="button" className={s.motionToggle} aria-label={paused ? "Play Discover animation" : "Pause Discover animation"} onClick={() => { pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); syncPlayback.current(); }}><Icon name={paused ? "play" : "pause"} size={14}/></button>
  </>;
}
