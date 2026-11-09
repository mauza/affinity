"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, time, type Profile } from "@/components/ui/client";
import s from "@/components/ui/attendee.module.css";
import { Icon } from "@/components/ui/icon";
type Session = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  room: string;
  level: string;
  url: string;
  reason?: string;
  crowd?: string[];
};
const days = ["2026-11-10", "2026-11-11", "2026-11-12"];
const labels: Record<string, string> = {
  packed: "Your people",
  quiet: "Quiet room",
  "table-after": "Table after",
};
export default function Plan() {
  const [day, setDay] = useState(days[0]),
    [text, setText] = useState(""),
    [items, setItems] = useState<Session[]>([]),
    [mine, setMine] = useState<Session[]>([]),
    [results, setResults] = useState<Session[]>([]),
    [q, setQ] = useState(""),
    [operation, setOperation] = useState<"generate" | "save" | "remove" | "search" | null>(null),
    [hasInterests, setHasInterests] = useState(true),
    [savingIds, setSavingIds] = useState<string[]>([]),
    [searched, setSearched] = useState(false),
    [searchError, setSearchError] = useState(""),
    [success, setSuccess] = useState(""),
    [agendaLoading, setAgendaLoading] = useState(true),
    [error, setError] = useState(""),
    [summary, setSummary] = useState("");
  const busy = operation !== null;
  useEffect(() => {
    api<{ profile: Profile | null }>("/api/me")
      .then((v) => setHasInterests(Boolean(v.profile?.interests.length)))
      .catch(() => {});
    api<{ today: string }>("/api/meta")
      .then((v) => setDay(days.find((d) => d >= v.today) || days[2]))
      .catch(() => {});
  }, []);
  const load = async () =>
    setMine(
      (await api<{ sessions: Session[] }>("/api/plans?day=" + day)).sessions,
    );
  useEffect(() => {
    let active = true;
    setMine([]);
    setAgendaLoading(true);
    setSearched(false);
    setSearchError("");
    setSuccess("");
    setError("");
    setItems([]);
    setResults([]);
    setSummary("");
    api<{ sessions: Session[] }>("/api/plans?day=" + day)
      .then((v) => {
        if (active) { setMine(v.sessions); setAgendaLoading(false); }
      })
      .catch((e) => { if (active) { setError(e.message); setAgendaLoading(false); } });
    return () => {
      active = false;
    };
  }, [day]);
  async function accept(ids: string[]) {
    setOperation("save");
    setSavingIds(ids);
    setError("");
    setSuccess("");
    try {
      await api("/api/plans", "POST", { sessionIds: ids });
      await load();
      setSuccess(ids.length > 1 ? "Added to your day." : "Added.");
      setItems((v) => v.filter((x) => !ids.includes(x.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function generate() {
    setOperation("generate");
    setError("");
    setSuccess("");
    try {
      const v = await api<{ items: Session[]; summary: string; usedAi: boolean }>("/api/planner", "POST", { day, text });
      setItems(v.items);
      setSummary(v.summary + (!v.usedAi ? " · Schedule-based picks" : ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function search() {
    setOperation("search");
    setError("");
    setSearched(false);
    setSearchError("");
    setResults([]);
    try {
      setResults((await api<{ sessions: Session[] }>("/api/sessions?day=" + day + "&q=" + encodeURIComponent(q))).sessions);
      setSearched(true);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  async function remove(id: string) {
    setOperation("remove");
    setError("");
    setSuccess("");
    try {
      await api("/api/plans?session=" + id, "DELETE");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  const clock = (v: string) => time(v).split(" ").pop();
  function cards(list: Session[], mode: "suggest" | "mine" | "search") {
    return list.map((item) => {
      const saved = mine.some((x) => x.id === item.id);
      return (
        <article className={s.session} key={item.id}>
          <div className={s.sessionTime}>{clock(item.starts_at)}<span>{clock(item.ends_at)}</span></div>
          <div className={s.sessionBody}>
            <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
            <p className={s.meta}>{[item.room.split(" | ").pop(), item.level].filter(Boolean).join(" · ")}</p>
            {item.crowd?.length ? <div className={s.tags}>{item.crowd.map((c) => <span className={s.tag} key={c}>{labels[c] || c}</span>)}</div> : null}
            {item.reason && <p className={s.reason}>{item.reason}</p>}
          </div>
          <div className={s.sessionActions}>
            {mode === "mine" ? (
              <button disabled={busy} onClick={() => void remove(item.id)}>Remove</button>
            ) : (
              <>
                <button className={saved ? s.done : s.add} disabled={busy || saved} onClick={() => accept([item.id])}>
                  {saved ? <><Icon name="check" size={14}/>Added</> : operation === "save" && savingIds.includes(item.id) ? "Adding…" : <><Icon name="plus" size={14}/>Add</>}
                </button>
                {mode === "suggest" && <button className={s.iconButton} aria-label="Dismiss suggestion" disabled={busy} onClick={() => setItems(items.filter((x) => x.id !== item.id))}><Icon name="close" size={14}/></button>}
              </>
            )}
          </div>
        </article>
      );
    });
  }
  return (
    <div className={s.narrow}>
      <header className={s.pageHead}>
        <h1>Agenda</h1>
        <p>AI picks sessions around your interests and keeps lunch free.</p>
      </header>
      <div className={s.segmented} role="group" aria-label="Event day">
        {days.map((d, i) => <button key={d} aria-pressed={day === d} disabled={busy} onClick={() => setDay(d)}>{["Tue 10", "Wed 11", "Thu 12"][i]}</button>)}
      </div>
      {!hasInterests && <p className={s.muted}><Link href="/">Add your interests</Link> for better picks.</p>}
      <div aria-live="polite">{success && <p className={s.notice}>{success}</p>}</div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {(agendaLoading || mine.length > 0) && (
        <section id="agenda" className={s.section} aria-labelledby="agenda-heading">
          <h2 id="agenda-heading">Your day <span className={s.count}>{agendaLoading ? "…" : mine.length}</span></h2>
          {agendaLoading ? <p className={s.muted} role="status">Loading…</p> : cards(mine, "mine")}
        </section>
      )}
      <section className={s.section}>
        <h2>Plan it for me</h2>
        <form className={s.inline} onSubmit={(e) => { e.preventDefault(); void generate(); }}>
          <input aria-label="What would make today good?" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="2h after lunch, meet AI infra people" />
          <button className={s.primary} disabled={busy}>{operation === "generate" ? "Planning…" : "Plan my day"}</button>
        </form>
        {operation === "generate" && <p className={s.muted} role="status">Checking sessions and crowds, about 10 seconds…</p>}
        {items.length > 0 && (
          <div className={s.resultsHead}>
            <p>{summary}</p>
            <button disabled={busy} onClick={() => accept(items.map((x) => x.id))}>{operation === "save" && savingIds.length > 1 ? "Adding…" : "Add all"}</button>
          </div>
        )}
        {cards(items, "suggest")}
        {items.length > 0 && <p className={s.footnote}>Crowd signals include simulated attendees.</p>}
      </section>
      <section className={s.section}>
        <h2>Search sessions</h2>
        <form className={s.inline} onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <input aria-label="Search sessions" value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Running models on Kubernetes" />
          <button disabled={busy || !q.trim()}><Icon name="search" size={15}/>{operation === "search" ? "Searching…" : "Search"}</button>
        </form>
        {searched && !results.length && <p className={s.muted} role="status">No sessions found. Try a broader topic or another day.</p>}
        {searchError && <p role="alert" className={s.error}>{searchError}</p>}
        {cards(results, "search")}
      </section>
    </div>
  );
}
