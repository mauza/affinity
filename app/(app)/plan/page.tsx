"use client";
import { useEffect, useState } from "react";
import { api, time } from "@/components/ui/client";
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState("");
  useEffect(() => {
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
    setItems([]);
    setResults([]);
    setSummary("");
    api<{ sessions: Session[] }>("/api/plans?day=" + day)
      .then((v) => {
        if (active) setMine(v.sessions);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [day]);
  async function accept(ids: string[]) {
    setBusy(true);
    try {
      await api("/api/plans", "POST", { sessionIds: ids });
      await load();
      setItems((v) => v.filter((x) => !ids.includes(x.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
                setBusy(true);
                try {
                  await api("/api/plans?session=" + item.id, "DELETE");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
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
                  ? "In your plan"
                  : "Accept session"}
              </button>
              {mode === "suggest" && (
                <button
                  onClick={() =>
                    setItems(items.filter((x) => x.id !== item.id))
                  }
                >
                  Swap / remove
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
      <p className={s.lead}>
        Find a session. Meet someone new. Keep lunch free.
      </p>
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
      <section className={s.card}>
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
            setBusy(true);
            setError("");
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
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : "Generate my plan"}
        </button>
        {busy && (
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
            Accept all
          </button>
        )}
        {cards(items, "suggest")}
      </section>
      <p role="alert" className={s.error}>
        {error}
      </p>
      <section className={s.card}>
        <h2>My plan</h2>
        {mine.length ? (
          cards(mine, "mine")
        ) : (
          <p className={s.muted}>
            Your day is open. Accept a suggestion or search below.
          </p>
        )}
      </section>
      <section className={s.card}>
        <h2>Find a session by meaning</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              setResults(
                (
                  await api<{ sessions: Session[] }>(
                    "/api/sessions?day=" + day + "&q=" + encodeURIComponent(q),
                  )
                ).sessions,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
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
          <button disabled={busy || !q.trim()}>Search sessions</button>
        </form>
        {cards(results, "search")}
      </section>
    </>
  );
}
