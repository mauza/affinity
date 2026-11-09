"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, count, type Interest, type Profile } from "./client";
import s from "./attendee.module.css";
import p from "./planning.module.css";
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
export default function Tables({
  alertsOnly = false,
  profileRevision = 0,
}: {
  alertsOnly?: boolean;
  profileRevision?: number;
}) {
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
  }, [profileRevision]);
  useEffect(() => {
    if (alertsOnly) return;
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
  }, [live, alertsOnly]);
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
  const alertPanel = (
    <details className={`${s.card} ${p.alertEntry}`} open={alertsOnly || undefined}>
        <summary>Gathering alerts · {alerts.length} saved <span className={p.summaryHint}>Create or manage an alert</span></summary>
        <p className={s.muted}>
          We’ll notify you here when people open to your topic gather.
        </p>
        {alerts.map((a) => (
          <div className={s.interest} key={a.id}>
            <span>
              {a.min_count}+ people · {label(a.topic)} ·{" "}
              {a.zone ? place(a.zone) : "any zone"}
            </span>
            <button
              disabled={busy}
              onClick={() =>
                action(() =>
                  api("/api/alerts?id=" + encodeURIComponent(a.id), "DELETE"),
                  "Alert deleted.",
                )
              }
            >
              Delete alert
            </button>
          </div>
        ))}
        {!alerts.length && <p>No alerts yet.</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(() =>
              api("/api/alerts", "POST", {
                topic,
                zone: zone || null,
                minCount: min,
              }),
              "Alert created. Notifications will appear here when it matches.",
            );
          }}
        >
          <label className={s.field}>
            Tell me when this many people gather
            <input
              type="number"
              min={3}
              max={50}
              required
              value={min}
              onChange={(e) => setMin(Number(e.target.value))}
            />
          </label>
          <label className={s.field}>
            Open to my interest
            <select
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">Choose an interest</option>
              {interests
                .filter((i) => own.includes(i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
            </select>
          </label>
          {!own.length && (
            <p>
              <Link href="/me">Save your interests first →</Link>
            </p>
          )}
          <label className={s.field}>
            Where?
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Any zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <button className={s.primary} disabled={busy || !topic}>
            {busy ? "Saving…" : "Create alert"}
          </button>
        </form>
      </details>
  );
  return (
    <>
      {alertsOnly && alertPanel}
      <div aria-live="polite">{busy ? <p role="status">Saving changes…</p> : success && <p className={p.success} role="status">{success}</p>}</div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {!alertsOnly && (
        <>
          <div className={s.eyebrow}>A SHARED INTEREST. AN OPEN SEAT.</div>
          <h1>Pull up a chair.</h1>
          <p className={s.lead}>
            Shared areas for people open to connect. Everyone is welcome; tables are not reserved or claimed.
          </p>
          <details className={p.tableFilters}><summary>Filter gatherings · {filter ? label(filter) : "All topics"}{live ? " · live only" : ""}</summary>
          <label className={s.field}>
            Filter by topic
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All topics</option>
              {interests.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={small}
              onChange={(e) => setSmall(e.target.checked)}
            />{" "}
            Find a smaller gathering
          </label>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
            />{" "}
            Live attendees only
          </label>
          </details>
          <p className={s.muted}>
            {live
              ? "Live attendees only"
              : "Includes simulated attendees · demo data"}{" "}
            · Refreshes every 30 seconds
          </p>
          {loaded && <p role="status" className={s.muted}>{visibleTables.length} {visibleTables.length === 1 ? "gathering" : "gatherings"}{filter ? ` for ${label(filter)}` : ""} · Your interests appear first</p>}
          {!loaded && <p role="status">Loading tables…</p>}
          {loaded && !visibleTables.length && (
            <section className={s.card}>
              <h2>{filter ? "No gatherings for this topic yet" : "No tables just yet"}</h2>
              <p>
                Check in on the map and open a topic, or create a gathering alert below.
              </p>
              <Link href="/map">Explore the map →</Link>
            </section>
          )}
          {visibleTables.map((t) => (
              <article className={s.card} key={t.id}>
                <h2>{label(t.topic)}</h2>
                {own.includes(t.topic) && <span className={p.match}>Matches you</span>}
                <p>
                  {count(t.count)} people · {place(t.zone)}
                </p>
                {t.newcomer_count > 0 && (
                  <span className={s.badge}>Newcomers welcome</span>
                )}
                {t.source === "sim" && (
                  <span className={s.badge}>Simulated</span>
                )}
                <p>{t.hint || "Look for others open to connect."}</p>
                <Link href={"/map?zone=" + encodeURIComponent(t.zone)}>
                  Find this zone →
                </Link>
              </article>
            ))}
          {alertPanel}
        </>
      )}
      {!alertsOnly && (
        <section id="notifications" className={s.card}>
          <h2>Notifications</h2>
          <button
            disabled={busy || !notifications.some((n) => !n.read)}
            onClick={() => action(() => api("/api/notifications", "POST"), "Notifications marked as read.")}
          >
            Mark all read
          </button>
          {!notifications.length && (
            <p className={s.muted}>
              Your gathering notifications will appear here.
            </p>
          )}
          {notifications.map((n) => (
            <article className={s.session} key={n.id}>
              <h3>
                {!n.read && "New · "}
                {label(n.message.topic)}
              </h3>
              <p>
                {count(n.message.count)} people · {place(n.message.zone)}
              </p>
              <p>{n.message.hint}</p>
              <Link href={"/map?zone=" + encodeURIComponent(n.message.zone)}>
                Find the gathering →
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
