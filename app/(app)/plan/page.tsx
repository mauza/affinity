"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import p from "@/components/ui/planning.module.css";
import { api, time, type Profile } from "@/components/ui/client";
import s from "@/components/ui/attendee.module.css";
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
  packed: "Packed with your people",
  quiet: "Quiet, easier to ask the speaker",
  "table-after": "Table forming after",
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
      setSuccess("Added to your agenda");
      setItems((v) => v.filter((x) => !ids.includes(x.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOperation(null);
    }
  }
  function cards(list: Session[], mode: "suggest" | "mine" | "search") {
    return list.map((item) => (
      <article className={s.session} key={item.id}>
        <div className={s.eyebrow}>
          {time(item.starts_at)} – {time(item.ends_at)} MST
        </div>
        <h3>
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title} ↗
          </a>
        </h3>
        <p className={s.muted}>
          {item.room} · {item.level}
        </p>
        {item.crowd?.map((c) => (
          <span className={s.badge} key={c}>
            {labels[c] || c}
          </span>
        ))}
        {item.reason && <p>{item.reason}</p>}
        <div className={s.row}>
          {mode === "mine" ? (
            <button
              disabled={busy}
              onClick={async () => {
                setOperation("remove");
                setError("");
                setSuccess("");
                try {
                  await api("/api/plans?session=" + item.id, "DELETE");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setOperation(null);
                }
              }}
            >
              Remove
            </button>
          ) : (
            <>
              <button
                disabled={busy || mine.some((x) => x.id === item.id)}
                onClick={() => accept([item.id])}
              >
                {mine.some((x) => x.id === item.id)
                  ? "In your agenda"
                  : operation === "save" && savingIds.includes(item.id) ? "Adding…" : "Add to agenda"}
              </button>
              {mode === "suggest" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    setItems(items.filter((x) => x.id !== item.id))
                  }
                >
                  Dismiss suggestion
                </button>
              )}
            </>
          )}
        </div>
      </article>
    ));
  }
  return (
    <>
      <div className={s.eyebrow}>LEAVE ROOM FOR A CONVERSATION</div>
      <h1>A day that fits you.</h1>
      <span className={s.badge}>Crowd signals include simulated attendees</span>
      <p className={s.muted}>Find sessions that fit. Keep lunch free for conversation.</p>
      {!hasInterests && <p className={s.muted}><Link href="/me">Add interests for more personal suggestions</Link> · Optional; you can generate or search now.</p>}
      <label className={s.field}>
        Event day
        <select disabled={busy} value={day} onChange={(e) => setDay(e.target.value)}>
          {days.map((d, i) => (
            <option key={d} value={d}>
              {
                ["Tuesday · Nov 10", "Wednesday · Nov 11", "Thursday · Nov 12"][
                  i
                ]
              }
            </option>
          ))}
        </select>
      </label>
      <div className={p.summary}>
        <a href={mine.length?"#agenda":"#planner"}>Saved agenda · {agendaLoading ? "Loading…" : `${mine.length} ${mine.length===1?"session":"sessions"}`} ↓</a>
        <span role="status">{success && <>{success}. <a href="#agenda">View agenda →</a></>}</span>
      </div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      {(agendaLoading||mine.length>0)&&<section id="agenda" className={`${s.card} ${p.anchor}`} aria-labelledby="agenda-heading">
        <h2 id="agenda-heading">Your saved agenda <span className={s.badge}>{mine.length} {mine.length===1?"session":"sessions"}</span></h2>
        {agendaLoading ? <p role="status">Loading your agenda…</p> : mine.length ? (
          cards(mine, "mine")
        ) : (
          <p className={s.muted}>
            Your day is open. Accept a suggestion or search below.
          </p>
        )}
      </section>}
      <section id="planner" className={s.card}>
        <h2>Make a plan</h2>
        <label className={s.field}>
          What would make today good?
          <textarea
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="2h after lunch, want to meet AI infra people"
          />
        </label>
        <button
          className={s.primary}
          disabled={busy}
          onClick={async () => {
            setOperation("generate");
            setError("");
            setSuccess("");
            try {
              const v = await api<{
                items: Session[];
                summary: string;
                usedAi: boolean;
              }>("/api/planner", "POST", { day, text });
              setItems(v.items);
              setSummary(
                v.summary + (!v.usedAi ? " · Schedule-based suggestions" : ""),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setOperation(null);
            }
          }}
        >
          {operation === "generate" ? "Generating…" : "Generate my plan"}
        </button>
        {operation === "generate" && (
          <p role="status">
            Finding sessions and checking crowd signals. This can take 10–15
            seconds…
          </p>
        )}
        <p>{summary}</p>
        {items.length > 0 && (
          <button
            disabled={busy}
            onClick={() => accept(items.map((x) => x.id))}
          >
            {operation === "save" && savingIds.length>1 ? "Adding all…" : "Add all to agenda"}
          </button>
        )}
        {cards(items, "suggest")}
      </section>
      <section className={s.card}>
        <h2>Find a session by meaning</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setOperation("search");
            setError("");
            setSearched(false);
            setSearchError("");
            setResults([]);
            try {
              setResults(
                (
                  await api<{ sessions: Session[] }>(
                    "/api/sessions?day=" + day + "&q=" + encodeURIComponent(q),
                  )
                ).sessions,
              );
              setSearched(true);
            } catch (e) {
              setSearchError((e as Error).message);
            } finally {
              setOperation(null);
            }
          }}
        >
          <label className={s.field}>
            What do you want to learn?
            <input
              value={q}
              maxLength={300}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Running models on Kubernetes"
            />
          </label>
          <button disabled={busy || !q.trim()}>{operation === "search" ? "Searching…" : "Search sessions"}</button>
        </form>
        <p role="status" className={s.muted}>{operation === "search" ? "Searching the schedule…" : searched ? (results.length ? `${results.length} sessions found` : "No sessions found. Try a broader topic or another day.") : "Search the schedule by topic or what you want to learn."}</p>
        {searchError && <p role="alert" className={s.error}>{searchError} Try searching again.</p>}
        {cards(results, "search")}
      </section>
    </>
  );
}
