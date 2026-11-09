"use client";
import { useEffect, useState } from "react";
import { clock, countLabel, FloorMap, get, Legend, type Meta, type Series, type TopicTable, type Insight } from "./shared";
import s from "./lobby.module.css";
type LobbyData = { at: string; counts: Record<string, number>; open: Record<string, number>; tables: TopicTable[]; trending: Insight[] };
const slides = ["Here now", "Find a table", "Murmuration"];
export default function Lobby({ qr }: { qr: string }) {
  const [meta, setMeta] = useState<Meta>(), [data, setData] = useState<LobbyData>(), [series, setSeries] = useState<Series>(), [labels, setLabels] = useState<Record<string, string>>({});
  const [slide, setSlide] = useState(0), [bucket, setBucket] = useState(0), [error, setError] = useState(""), [updated, setUpdated] = useState(0), [now, setNow] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setNow(Date.now());
    get<Meta>("/api/meta", c.signal).then(setMeta).catch(e => { if (!c.signal.aborted) setError(e.message); });
    get<{ interests: { id: string; label: string }[] }>("/api/interests/all", c.signal).then(r => setLabels(Object.fromEntries(r.interests.map(i => [i.id, i.label])))).catch(() => {});
    const load = () => get<LobbyData>("/api/lobby", c.signal).then(r => { setData(r); setUpdated(Date.now()); setError(""); }).catch(e => { if (!c.signal.aborted) setError(e.message); });
    void load(); const timer = setInterval(load, 15000), cycle = setInterval(() => setSlide(v => (v + 1) % slides.length), 12000), tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { c.abort(); clearInterval(timer); clearInterval(cycle); clearInterval(tick); };
  }, []);
  useEffect(() => {
    if (!meta) return;
    const c = new AbortController();
    const load = async () => {
      try {
        let r = await get<Series>("/api/murmuration?day=" + meta.today, c.signal);
        if (!r.peak) r = await get<Series>("/api/murmuration?day=2026-11-10", c.signal);
        setSeries(r);
      } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    };
    void load(); const timer = setInterval(load, 60000);
    return () => { c.abort(); clearInterval(timer); };
  }, [meta]);
  useEffect(() => {
    if (!series) return;
    const available = series.day === meta?.today ? series.times.filter(t => new Date(t).getTime() <= Date.now()).length : series.times.length;
    const timer = setInterval(() => setBucket(b => (b + 1) % Math.max(1, available)), 100);
    return () => clearInterval(timer);
  }, [series, meta]);
  const counts = slide === 2 ? Object.fromEntries(Object.entries(series?.zones ?? {}).map(([id, vs]) => [id, vs[bucket] ?? 0])) : data?.counts ?? {};
  return <main className={s.lobby}>
    <header className={s.header}><div><p>KUBECON NORTH AMERICA 2026</p><h1>Affinity<span>Find your pod.</span></h1></div><div className={s.clock}>{now ? clock(new Date(now).toISOString()) : "—:—"}<small>MST · Salt Lake City</small></div></header>
    <div className={s.layout}><section className={s.content}><div className={s.title}><h2>{slides[slide]}</h2><span>{slide === 2 ? `${series?.day ?? "Loading"} · ${series?.times[bucket] ? clock(series.times[bucket]) : "00:00"} MST · presence replay` : "Shared interests. Real connections."}</span></div>
      {error && <p role="alert" className={s.error}>Connection interrupted · {error} · retrying</p>}
      {slide === 1 ? <div className={s.tables}>{data?.tables.length ? data.tables.slice(0, 6).map(t => <article key={t.id}><strong>{labels[t.topic] || t.topic}</strong><span>{countLabel(t.count)} people · {meta?.zones.find(z => z.id === t.zone)?.name || t.zone}</span><p>{t.hint || "Pull up a chair. Everyone is welcome."}</p></article>) : <div className={s.empty}><h3>Your next conversation starts here.</h3><p>Check in, share a topic, and open a table.<br/>First KubeCon? You belong here.</p></div>}</div> : <div className={s.maps}>{meta?.floors.map(f => <FloorMap key={f.id} floor={f} zones={meta.zones} counts={counts} mode={slide === 2 ? "presence replay" : "here now"} peak={slide === 2 ? Math.max(3, series?.peak ?? 30) : 30}/>)}</div>}
      {slide !== 1 && <Legend peak={slide === 2 ? Math.max(3, series?.peak ?? 30) : 30}/>}
      <div className={s.dots}>{slides.map((title, i) => <button key={title} aria-label={title} aria-pressed={slide === i} onClick={() => setSlide(i)}/>)}</div>
    </section><aside className={s.join}><p className={s.eyebrow}>YOUR PEOPLE ARE HERE</p><h2>Join the<br/>flow.</h2><div className={s.qr} dangerouslySetInnerHTML={{ __html: qr }}/><strong>kubecon.mau.guru</strong><p>Pick your interests.<br/>Find a space.<br/>Make a connection.</p><span className={s.badge}>Includes simulated attendees</span><small>{updated ? `Updated ${Math.max(0, Math.floor((now - updated) / 1000))}s ago` : "Connecting…"}</small></aside></div>
    <footer className={s.ticker}><strong>TRENDING NOW</strong><span>{data?.trending.length ? data.trending.slice(0, 5).map(i => `${labels[i.interest] || i.interest} · ${i.ratio.toFixed(1)}×`).join("     /     ") : "A shared interest is all it takes. Scan to find your people."}</span></footer>
  </main>;
}
