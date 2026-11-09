"use client";
import { useEffect, useState } from "react";
import { clock, countLabel, FloorMap, get, Legend, type Meta, type Zone, type Series, type TopicTable, type Insight } from "./shared";
import s from "./map.module.css";

const modes = { now: "Here now", open: "Open to connect", planned: "Planned", murmuration: "Murmuration" };
type Mode = keyof typeof modes;
type Profile = { interests: string[]; interestLabels: Record<string, string> };
type Stint = { zone: string; active: { lt: string } };
export default function MapApp() {
  const [meta, setMeta] = useState<Meta>(), [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Mode>("now"), [floor, setFloor] = useState("sp1"), [list, setList] = useState(false);
  const [live, setLive] = useState(false), [filters, setFilters] = useState<string[]>([]), [day, setDay] = useState(""), [replayDay, setReplayDay] = useState("2026-11-10");
  const [minute, setMinute] = useState(720), [bucket, setBucket] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(200);
  const [counts, setCounts] = useState<Record<string, number>>({}), [series, setSeries] = useState<Series>();
  const [selected, setSelected] = useState<Zone>(), [tables, setTables] = useState<TopicTable[]>([]), [insights, setInsights] = useState<Insight[]>([]), [labels, setLabels] = useState<Record<string, string>>({});
  const [topics, setTopics] = useState<string[]>([]), [hint, setHint] = useState(""), [stint, setStint] = useState<Stint | null>(null);
  const [updated, setUpdated] = useState(0), [now, setNow] = useState(Date.now()), [revision, refresh] = useState(0), [error, setError] = useState(""), [detailError, setDetailError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    const c = new AbortController();
    get<Meta>("/api/meta", c.signal).then(m => { setMeta(m); setDay(m.today); setMinute(Number(clock(m.now).slice(0, 2)) * 60 + Number(clock(m.now).slice(3))); }).catch(e => { if (!c.signal.aborted) setError(e.message); });
    get<{ profile: Profile | null }>("/api/me", c.signal).then(r => setProfile(r.profile)).catch(() => {});
    get<{ interests: { id: string; label: string }[] }>("/api/interests/all", c.signal).then(r => setLabels(Object.fromEntries(r.interests.map(i => [i.id, i.label])))).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { c.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!day) return;
    const c = new AbortController();
    const load = async () => {
      try {
        const q = new URLSearchParams({ ...(live ? { live: "1" } : {}), interests: filters.join(",") });
        if (mode === "murmuration") {
          q.set("day", replayDay); q.set("kind", "presence");
          setSeries(await get<Series>("/api/murmuration?" + q, c.signal));
        } else {
          q.set("mode", mode);
          if (mode === "planned") q.set("at", `${day}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00-07:00`);
          const r = await get<{ counts: Record<string, number> }>("/api/map?" + q, c.signal);
          setCounts(r.counts);
        }
        setUpdated(Date.now()); setError("");
      } catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    };
    setCounts({}); setSeries(undefined); setUpdated(0); void load();
    const timer = setInterval(load, 15000);
    return () => { c.abort(); clearInterval(timer); };
  }, [mode, day, replayDay, minute, live, filters, revision]);
  useEffect(() => {
    if (!playing || mode !== "murmuration" || !series?.times.length) return;
    const timer = setInterval(() => setBucket(b => (b + 1) % series.times.length), speed);
    return () => clearInterval(timer);
  }, [playing, mode, series, speed]);
  useEffect(() => {
    const c = new AbortController();
    setTables([]); setInsights([]); setDetailError("");
    get<{ stint: Stint | null }>("/api/presence", c.signal).then(r => setStint(r.stint)).catch(() => {});
    if (selected) Promise.all([
      get<{ tables: TopicTable[] }>(`/api/tables?zone=${selected.id}${live ? "&live=1" : ""}`, c.signal),
      get<{ insights: Insight[] }>(`/api/insights?kind=zone&zone=${selected.id}${live ? "&live=1" : ""}`, c.signal)
    ]).then(([t, i]) => { setTables(t.tables); setInsights(i.insights); }).catch(e => { if (!c.signal.aborted) setDetailError(e.message); });
    return () => c.abort();
  }, [selected, live, revision]);
  async function action(action: "checkin" | "renew" | "leave", open = false) {
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...(action === "checkin" ? { zone: selected?.id, openTopics: open ? topics : [], hint: open ? hint : "" } : {}) }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || "Could not update presence");
      setStint(body.stint); refresh(v => v + 1); setNotice(action === "leave" ? "You have left." : "Presence updated for 30 minutes.");
    } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  }
  const shown = mode === "murmuration" ? Object.fromEntries(Object.entries(series?.zones ?? {}).map(([id, values]) => [id, values[bucket] ?? 0])) : counts;
  const toggle = (id: string, values: string[], setter: (v: string[]) => void) => setter(values.includes(id) ? values.filter(v => v !== id) : values.length < 3 ? [...values, id] : values);
  return <div className={s.app}>
    <header className={s.heading}><div><p className={s.eyebrow}>KUBECON NORTH AMERICA · SALT LAKE CITY</p><h1>Find your people.</h1><p className={s.muted}>Follow the flow. Make a connection. Find your pod.</p></div><span className={s.badge}>{live ? "Live attendees only" : "Includes simulated attendees"}</span></header>
    <div className={s.toolbar}><div className={s.tabs} aria-label="Map mode">{Object.entries(modes).map(([id, label]) => <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id as Mode); setPlaying(false); }}>{label}</button>)}</div><label><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)}/> Live only</label><button aria-pressed={list} onClick={() => setList(!list)}>{list ? "Map view" : "List view"}</button></div>
    <section className={s.filters}><span className={s.muted}>Your interests · choose up to 3 · matches any</span><div className={s.tabs}>{profile?.interests.map(id => <button key={id} disabled={!filters.includes(id) && filters.length === 3} aria-pressed={filters.includes(id)} onClick={() => toggle(id, filters, setFilters)}>{profile.interestLabels[id] || id}</button>)}{!profile && <a href="/">Set your interests →</a>}</div></section>
    {(mode === "planned" || mode === "murmuration") && <section className={s.player}>
      <label>Day <input type="date" value={mode === "planned" ? day : replayDay} onChange={e => { if (!e.target.value) return; mode === "planned" ? setDay(e.target.value) : setReplayDay(e.target.value); setBucket(0); }}/></label>
      {mode === "murmuration" && <><button disabled={!series} onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"} flow</button><label>Speed <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={600}>Slow</option><option value={200}>Normal</option><option value={70}>Fast</option></select></label></>}
      <input aria-label={mode === "planned" ? "Planned time" : "Replay time"} className={s.scrub} type="range" min="0" max={mode === "planned" ? 1435 : Math.max(0, (series?.times.length ?? 1) - 1)} step={mode === "planned" ? 5 : 1} value={mode === "planned" ? minute : bucket} onChange={e => mode === "planned" ? setMinute(Number(e.target.value)) : setBucket(Number(e.target.value))}/>
      <strong>{mode === "planned" ? `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` : series?.times[bucket] ? clock(series.times[bucket]) : "00:00"} MST</strong>
    </section>}
    <div className={s.status}><strong>{modes[mode]}{mode === "murmuration" ? " · presence replay" : ""}</strong><span>{updated ? `Updated ${Math.max(0, Math.floor((now - updated) / 1000))}s ago` : "Loading…"}</span></div>
    {error && <p role="alert" className={s.error}>Map unavailable: {error}. Retrying every 15 seconds.</p>}
    <div className={s.workspace}><div className={s.canvas}>
      {mode !== "murmuration" && <div className={s.tabs} aria-label="Floor">{meta?.floors.map(f => <button key={f.id} aria-pressed={floor === f.id} onClick={() => setFloor(f.id)}>{f.name}</button>)}</div>}
      {list ? <table className={s.table}><caption>{modes[mode]} · all floors</caption><thead><tr><th>Zone</th><th>Floor</th><th>{modes[mode]}</th></tr></thead><tbody>{meta?.zones.map(z => <tr key={z.id}><td><button onClick={() => setSelected(z)}>{z.name}</button></td><td>{meta.floors.find(f => f.id === z.floor)?.name}</td><td>{countLabel(shown[z.id] ?? 0)}</td></tr>)}</tbody></table> : <div className={mode === "murmuration" ? s.grid : undefined}>{meta?.floors.filter(f => mode === "murmuration" || f.id === floor).map(f => <FloorMap key={f.id} floor={f} zones={meta.zones} counts={shown} mode={modes[mode]} peak={mode === "murmuration" ? Math.max(3, series?.peak ?? 30) : 30} selected={selected?.id} onSelect={setSelected}/>)}</div>}
      <Legend peak={mode === "murmuration" ? Math.max(3, series?.peak ?? 30) : 30}/>
      <p className={s.credit}>Schematic · not to scale · <a href="https://events.linuxfoundation.org/kcna26-venue-map">official venue map</a></p>
      <details><summary>Quiet spaces & facilities</summary>{meta?.facilities.map((f, i) => <p key={i}><strong>{f.name}</strong> · {f.where}</p>)}</details>
    </div>
    <aside className={s.panel}>{selected ? <>
      <button className={s.close} aria-label="Close zone details" onClick={() => setSelected(undefined)}>×</button><p className={s.eyebrow}>{meta?.floors.find(f => f.id === selected.floor)?.name}</p><h2>{selected.name}</h2><p className={s.big}>{countLabel(shown[selected.id] ?? 0)} <small>{modes[mode].toLowerCase()}</small></p>{selected.note && <p>{selected.note}</p>}
      <h3>Active tables · now</h3>{detailError && <p role="alert">{detailError}</p>}{!tables.length && <p className={s.muted}>No active tables here yet.</p>}{tables.map(t => <article key={t.id} className={s.card}><strong>{labels[t.topic] || t.topic}</strong> · {countLabel(t.count)}<p>{t.hint || "Everyone is welcome."}</p></article>)}
      <h3>Unusually popular here · now</h3>{insights.length ? insights.map(i => <p key={i.interest}>{labels[i.interest] || i.interest} · {i.ratio.toFixed(1)}× more popular · {countLabel(i.count)}</p>) : <p className={s.muted}>More shared interests will reveal patterns.</p>}
      <hr/>{profile ? <><h3>Join this space · now</h3><p className={s.muted}>Check-ins last 30 minutes. Renew to stay visible.</p><button disabled={busy} onClick={() => action("checkin")}>Check in here</button><p>Open to connect about <small>(up to 3)</small></p><div className={s.tabs}>{profile.interests.map(id => <button key={id} disabled={!topics.includes(id) && topics.length === 3} aria-pressed={topics.includes(id)} onClick={() => toggle(id, topics, setTopics)}>{profile.interestLabels[id] || id}</button>)}</div><label>Meetup hint<input className={s.hint} maxLength={80} value={hint} placeholder="By the coffee station" onChange={e => setHint(e.target.value)}/></label><button disabled={busy || !topics.length} onClick={() => action("checkin", true)}>Open to connect here</button></> : <a href="/">Set interests to check in →</a>}
    </> : <><p className={s.eyebrow}>A LITTLE CURIOSITY GOES A LONG WAY</p><h2>Where will you land?</h2><p className={s.muted}>Choose a space to discover shared interests, find a table, or check in.</p><p>Try <strong>Murmuration</strong> to watch the conference come together.</p></>}
    {stint && <div className={s.card}><strong>You're checked in</strong><p>{meta?.zones.find(z => z.id === stint.zone)?.name || stint.zone} · until {clock(stint.active.lt)} MST</p><button disabled={busy} onClick={() => action("renew")}>Renew</button> <button disabled={busy} onClick={() => action("leave")}>Leave</button></div>}<p role="status">{notice}</p>
    </aside></div>
  </div>;
}
