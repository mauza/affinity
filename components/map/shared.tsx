"use client";

import s from "./map.module.css";
import { useEffect, useId, useRef, useState } from "react";

export type Floor = { id: string; name: string; venue: string; viewBox: number[]; background?: { href: string; width: number; height: number; clip?: string } };
export type Zone = { id: string; name: string; floor: string; kind: string; rect: number[]; parent?: string; note?: string };
export type Meta = { floors: Floor[]; zones: Zone[]; days: string[]; today: string; now: string; facilities: { name: string; where: string; zone?: string }[] };
export type Series = { day: string; times: string[]; zones: Record<string, number[]>; peak: number };
export type TopicTable = { id: string; zone: string; topic: string; count: number; hint?: string };
export type Insight = { interest: string; ratio: number; count: number };
export const countLabel = (n: number) => n === 1 || n === 2 ? "a few" : String(n);
export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit" });
export async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, cache: "no-store" });
  if (!r.ok) { const body = await r.json().catch(() => ({})); throw new Error(body.error || `Request failed (${r.status})`); }
  return r.json();
}
export const colors = ["#edf0e7", "#a5c797", "#699e69", "#317858", "#cf773d"];
export function heat(n: number, peak = 30) { return colors[n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(n / Math.max(3, peak) * 4)))]; }
export function FloorMap({ floor, zones, counts, mode, peak = 30, selected, onSelect }: { floor: Floor; zones: Zone[]; counts: Record<string, number>; mode: string; peak?: number; selected?: string; onSelect?: (z: Zone) => void }) {
  const clipId = useId(), svg = useRef<SVGSVGElement>(null);
  const [badgeScale, setBadgeScale] = useState(1);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setBadgeScale(Math.max(1, 12 * floor.viewBox[2] / (13 * entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [floor.viewBox]);
  const ordered = zones.filter(z => z.floor === floor.id).sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  return <section className={s.floor}><h3>{floor.name}</h3><svg ref={svg} viewBox={floor.viewBox.join(" ")} aria-label={floor.name} role="group">
    {floor.background?.clip && <defs><clipPath id={clipId}><polygon points={floor.background.clip}/></clipPath></defs>}
    {floor.background && <image href={floor.background.href} width={floor.background.width} height={floor.background.height} x="0" y="0" preserveAspectRatio="none" className={s.venueArtwork} clipPath={floor.background.clip?`url(#${clipId})`:undefined}/>}
    {ordered.map(z => {
      const [x, y, w, h] = z.rect, n = counts[z.id] ?? 0;
      const short = z.name.split(" · ")[0];
      const words = short.split(" "), lines: string[] = [];
      for (const word of words) { if (!lines.length || (lines[lines.length - 1].length + word.length > Math.max(9, w / 8))) lines.push(word); else lines[lines.length - 1] += " " + word; }
      return <g key={z.id} role={onSelect ? "button" : "img"} tabIndex={onSelect ? 0 : undefined} aria-label={`${z.name}: ${countLabel(n)} people ${mode.toLowerCase()}`} aria-pressed={onSelect ? selected === z.id : undefined} onClick={() => onSelect?.(z)} onKeyDown={e => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(z); } }} className={s.zone}>
        <title>{z.name}{z.note ? " · " + z.note : ""}: {countLabel(n)} · {mode}</title>
        {floor.background ? <>
          {n>0 && <ellipse cx={x+w/2} cy={y+h/2} rx={Math.max(17,w*.48)} ry={Math.max(17,h*.48)} fill={heat(n,peak)} opacity=".24" pointerEvents="none"/>}
          <rect x={x} y={y} width={w} height={h} rx="3" fill="transparent" stroke={selected===z.id?"#174e3b":"transparent"} strokeWidth="3" className={s.hitArea}/>
          {(n>0||selected===z.id)&&<g pointerEvents="none" transform={`translate(${x+w/2} ${y+h/2}) scale(${badgeScale})`}><rect x={-Math.max(19,countLabel(n).length*4.2+7)} y={-15} width={Math.max(38,countLabel(n).length*8.4+14)} height="30" rx="15" fill={n>peak*.75?"#b75d28":"#245a43"} stroke="white" strokeWidth="2"/><text x={0} y={5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{countLabel(n)}</text></g>}
        </> : <><rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="7" fill={heat(n, peak)} stroke={selected === z.id ? "#174e3b" : "#a4b99e"} strokeWidth={selected === z.id ? 4 : 1}/>
        <text x={x + w / 2} y={y + h / 2 - (Math.min(lines.length, 3) - 1) * 7 - 5} textAnchor="middle" fill="#173b32" fontSize={Math.min(14, h / 3.8)} fontWeight="600" pointerEvents="none">
          {lines.slice(0, 3).map((line, i) => <tspan key={i} x={x + w / 2} dy={i ? "1.1em" : 0}>{line}</tspan>)}
          <tspan x={x + w / 2} dy="1.3em" fontWeight="800">{countLabel(n)}</tspan>
        </text></>}
      </g>;
    })}
  </svg></section>;
}
export function Legend({ peak = 30 }: { peak?: number }) {
  return <div className={s.legend} aria-label="Fixed heat scale"><span>People</span>{colors.map((c, i) => <span key={c}><i style={{ background: c }}/>{i === 0 ? "0" : i === 4 ? `${Math.floor(peak * .75) + 1}+` : `≤${Math.floor(peak * i / 4)}`}</span>)}<small>1–2 always shown as “a few”</small></div>;
}
