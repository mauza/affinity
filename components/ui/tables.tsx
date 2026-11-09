"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, count, type Interest, type Profile } from "./client";
import s from "./attendee.module.css";
import { Icon } from "./icon";
type Alert = {
  id: string;
  topic: string;
  zone: string | null;
  min_count: number;
};
type Table = {
  id: string;
  topic: string;
  zone: string;
  count: number;
  newcomer_count: number;
  hint: string;
  source?: string;
};
type Notification = {
  id: string;
  read: boolean;
  message: { topic: string; zone: string; count: number; hint: string };
};
export default function Tables() {
  const [tables, setTables] = useState<Table[]>([]),
    [alerts, setAlerts] = useState<Alert[]>([]),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [interests, setInterests] = useState<Interest[]>([]),
    [zones, setZones] = useState<{ id: string; name: string }[]>([]),
    [own, setOwn] = useState<string[]>([]),
    [topic, setTopic] = useState(""),
    [zone, setZone] = useState(""),
    [min, setMin] = useState(3),
    [filter, setFilter] = useState(""),
    [success, setSuccess] = useState(""),
    [small, setSmall] = useState(false),
    [live, setLive] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const refresh = async () => {
    const [a, n] = await Promise.all([
      api<{ alerts: Alert[] }>("/api/alerts"),
      api<{ notifications: Notification[] }>("/api/notifications"),
    ]);
    setAlerts(a.alerts);
    setNotifications(n.notifications);
  };
  useEffect(() => {
    Promise.all([
      api<{ interests: Interest[] }>("/api/interests/all"),
      api<{ zones: { id: string; name: string }[] }>("/api/meta"),
      api<{ profile: Profile | null }>("/api/me"),
    ])
      .then(([i, m, p]) => {
        setInterests(i.interests);
        setZones(m.zones);
        setOwn(p.profile?.interests || []);
        setTopic(p.profile?.interests[0] || "");
      })
      .catch((e) => setError(e.message));
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    const poll = () =>
      api<{ tables: Table[] }>("/api/tables" + (live ? "?live=1" : ""))
        .then((v) => {
          if (active) {
            setTables(v.tables);
            setLoaded(true);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [live]);
  const label = (id: string) => interests.find((i) => i.id === id)?.label || id;
  const place = (id: string) => zones.find((z) => z.id === id)?.name || id;
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await refresh();
      setSuccess(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visibleTables = tables
    .filter((t) => !filter || t.topic === filter)
    .sort((a, b) => Number(own.includes(b.topic)) - Number(own.includes(a.topic)) || (small ? a.count - b.count : 0));
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <div className={s.narrow}>
      <header className={s.pageHead}>
        <h1>Tables</h1>
        <p>Pop-up conversations. Nobody owns a table; everyone is welcome.</p>
      </header>
      <div className={s.filters}>
        <select aria-label="Topic" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All topics</option>
          {interests.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        <label className={s.toggle}><input type="checkbox" checked={small} onChange={(e) => setSmall(e.target.checked)} />Smaller first</label>
        <label className={s.toggle}><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />Live only</label>
      </div>
      <div aria-live="polite">{success && <p className={s.notice} role="status">{success}</p>}</div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {!loaded && <p className={s.muted} role="status">Loading tables…</p>}
      {loaded && !visibleTables.length && (
        <div className={s.empty}>
          <p>{filter ? "No tables on this topic yet." : "No tables right now."}</p>
          <Link className={s.ghost} href="/map">Open a topic on the map<Icon name="arrow" size={15}/></Link>
        </div>
      )}
      <div className={s.grid}>
        {visibleTables.map((t) => (
          <article className={s.tableCard} key={t.id}>
            <div className={s.tableTop}><h3>{label(t.topic)}</h3><span className={s.bigCount}>{count(t.count)}</span></div>
            <p className={s.meta}>{place(t.zone)}</p>
            {t.hint && <p className={s.reason}>{t.hint}</p>}
            <div className={s.tags}>
              {own.includes(t.topic) && <span className={`${s.tag} ${s.tagAccent}`}>Your topic</span>}
              {t.newcomer_count > 0 && <span className={s.tag}>Newcomers welcome</span>}
              {t.source === "sim" && <span className={s.tag}>Simulated</span>}
            </div>
            <Link className={s.cardLink} href={"/map?zone=" + encodeURIComponent(t.zone)}>Find it<Icon name="arrow" size={14}/></Link>
          </article>
        ))}
      </div>
      {loaded && <p className={s.footnote}>{visibleTables.length} open · {live ? "live attendees only" : "includes simulated attendees"} · updates every 30s</p>}

      <section className={s.section}>
        <h2>Alerts <span className={s.count}>{alerts.length}</span></h2>
        {alerts.map((a) => (
          <div className={s.listRow} key={a.id}>
            <span>{a.min_count}+ people · {label(a.topic)} · {a.zone ? place(a.zone) : "anywhere"}</span>
            <button className={s.iconButton} aria-label="Delete alert" disabled={busy} onClick={() => action(() => api("/api/alerts?id=" + encodeURIComponent(a.id), "DELETE"), "Alert deleted.")}><Icon name="close" size={14}/></button>
          </div>
        ))}
        {own.length ? (
          <form className={s.sentence} onSubmit={(e) => { e.preventDefault(); void action(() => api("/api/alerts", "POST", { topic, zone: zone || null, minCount: min }), "Alert saved."); }}>
            Notify me when
            <input aria-label="Minimum people" type="number" min={3} max={50} required value={min} onChange={(e) => setMin(Number(e.target.value))} />
            people open to
            <select aria-label="Topic" required value={topic} onChange={(e) => setTopic(e.target.value)}>
              {interests.filter((i) => own.includes(i.id)).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            gather
            <select aria-label="Where" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">anywhere</option>
              {zones.map((z) => <option key={z.id} value={z.id}>in {z.name}</option>)}
            </select>
            <button className={s.primary} disabled={busy || !topic}>{busy ? "Saving…" : "Save alert"}</button>
          </form>
        ) : <p className={s.muted}><Link href="/">Add your interests</Link> to set alerts.</p>}
      </section>

      <section id="notifications" className={s.section}>
        <h2>Notifications <span className={s.count}>{unread}</span>{unread > 0 && <button className={s.textButton} disabled={busy} onClick={() => action(() => api("/api/notifications", "POST"), "Marked as read.")}>Mark all read</button>}</h2>
        {!notifications.length && <p className={s.muted}>Nothing yet. Alerts show up here.</p>}
        {notifications.map((n) => (
          <Link className={`${s.listRow} ${n.read ? "" : s.unread}`} key={n.id} href={"/map?zone=" + encodeURIComponent(n.message.zone)}>
            <span><strong>{label(n.message.topic)}</strong> · {count(n.message.count)} people · {place(n.message.zone)}{n.message.hint ? ` · ${n.message.hint}` : ""}</span>
            <Icon name="arrow" size={14}/>
          </Link>
        ))}
      </section>
    </div>
  );
}
