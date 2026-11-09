"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type Interest, type Profile } from "./client";
import s from "./attendee.module.css";
export default function ProfileEditor({ home = false }: { home?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(""),
    [publicName, setPublicName] = useState(false),
    [newcomer, setNewcomer] = useState(false);
  const [text, setText] = useState(""),
    [selected, setSelected] = useState<Interest[]>([]),
    [publicIds, setPublicIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Interest[]>([]),
    [refining, setRefining] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const version = useRef(0);
  useEffect(() => {
    api<{ profile: Profile | null }>("/api/me")
      .then(({ profile: p }) => {
        setProfile(p);
        if (p) {
          setName(p.display_name || "");
          setPublicName(!!p.public_name);
          setNewcomer(!!p.newcomer);
          setPublicIds(p.public_interests);
          setSelected(
            p.interests.map((id) => ({
              id,
              label: p.interestLabels?.[id] || id,
            })),
          );
        }
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, []);
  async function refine(value: string, generation: number) {
    setRefining(true);
    try {
      const r = await api<{ interests: Interest[] }>(
        "/api/interests/refine",
        "POST",
        { text: value },
      );
      if (version.current === generation)
        setSuggestions((previous) => [
          ...r.interests,
          ...previous.filter((i) => !r.interests.some((match) => match.id === i.id)),
        ]);
    } catch {
      if (version.current === generation)
        setMessage(
          "AI refinement is unavailable. You can still choose search suggestions.",
        );
    } finally {
      if (version.current === generation) setRefining(false);
    }
  }
  useEffect(() => {
    const generation = ++version.current;
    setRefining(false);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const fast = setTimeout(() => {
      api<{ interests: Interest[] }>(
        "/api/interests/suggest?q=" + encodeURIComponent(text),
      )
        .then((r) => {
          if (version.current === generation) setSuggestions(r.interests);
        })
        .catch(() => {});
    }, 200);
    const slow = setTimeout(() => void refine(text, generation), 1200);
    return () => {
      clearTimeout(fast);
      clearTimeout(slow);
    };
  }, [text]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/me", "PUT", {
        display_name: name || null,
        public_name: publicName,
        newcomer,
        interests: selected.map((i) => i.id),
        public_interests: publicIds.filter((id) =>
          selected.some((i) => i.id === id),
        ),
        raw_text: text,
      });
      setProfile((await api<{ profile: Profile }>("/api/me")).profile);
      setMessage("Saved. Your pod is out there.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!loaded) return <p role="status">Loading your profile…</p>;
  return (
    <>
      <div className={s.eyebrow}>YOUR PEOPLE, SOMEWHERE NEARBY</div>
      <h1>{home ? "Find your pod." : "Your space."}</h1>
      <p className={s.lead}>
        {home
          ? "Turn shared interests into a conversation. A session, a coffee, a table with room for you."
          : "Choose what you share. Everything starts private."}
      </p>
      {home && (
        <ol className={s.steps}>
          <li>Tell us what interests you</li>
          <li>Make a little room in your day</li>
          <li>Meet your people</li>
        </ol>
      )}
      {home && profile && (
        <div className={s.card}>
          <h2>Welcome back{name ? ", " + name : ""}.</h2>
          <p>{selected.map((i) => i.label).join(" · ")}</p>
          <div className={s.row}>
            <Link href="/plan">Plan my day →</Link>
            <Link href="/tables">Find a table →</Link>
            <Link href="/map">Explore the map →</Link>
          </div>
        </div>
      )}
      <section className={s.card}>
        <h2>
          {profile ? "Edit your profile" : "Start with a little about you"}
        </h2>
        <label className={s.field}>
          Display name <span>(optional)</span>
          <input
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={publicName}
            onChange={(e) => setPublicName(e.target.checked)}
          />{" "}
          Show my name on tables I join
        </label>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={newcomer}
            onChange={(e) => setNewcomer(e.target.checked)}
          />{" "}
          First KubeCon / came alone
        </label>
        <label className={s.field}>
          What are you into?
          <textarea
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. AI infrastructure, GitOps, and making my first contribution"
          />
        </label>
        <p className={s.muted}>
          Pick up to 15 interests. Choose a suggestion to confirm it.
        </p>
        <div role="status" className={s.muted}>
          {refining
            ? "Refining your interests…"
            : "Suggestions update as you type."}
        </div>
        <div className={s.chips}>
          {suggestions
            .filter((i) => !selected.some((x) => x.id === i.id))
            .map((i) => (
              <button
                key={i.id}
                disabled={selected.length >= 15}
                onClick={() => setSelected([...selected, i])}
              >
                + {i.label}
                {i.isNew ? " · new category" : ""}
              </button>
            ))}
        </div>
        {selected.map((i) => (
          <div className={s.interest} key={i.id}>
            <strong>{i.label}</strong>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={publicIds.includes(i.id)}
                onChange={(e) =>
                  setPublicIds(
                    e.target.checked
                      ? [...publicIds, i.id]
                      : publicIds.filter((id) => id !== i.id),
                  )
                }
              />{" "}
              Public
            </label>
            <button
              aria-label={"Remove " + i.label}
              onClick={() => setSelected(selected.filter((x) => x.id !== i.id))}
            >
              Remove
            </button>
          </div>
        ))}
        <p className={s.muted}>
          Private interests help personalize your plan. Only interests you mark
          public may be shared.
        </p>
        <div className={s.row}>
          <button
            disabled={busy || selected.length === 0}
            className={s.primary}
            onClick={save}
          >
            {busy ? "Saving…" : "Save my interests"}
          </button>
          <button
            disabled={refining || text.trim().length < 2}
            onClick={() => void refine(text, version.current)}
          >
            Refine now
          </button>
        </div>
        <p role="status">{message}</p>
      </section>
      {!home && (
        <section className={s.card}>
          <h2>Privacy, in plain language</h2>
          <p>
            Your raw text stays private. Public views show aggregates, not
            personal histories. Interest-based counts of 1–2 appear as “a few”;
            exact counts start at 3. Demo views label simulated attendees.
          </p>
          <p>
            Live data is deleted on November 19, 2026. You can delete yours
            sooner.
          </p>
          <button
            className={s.danger}
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Delete your profile, plans, check-ins, alerts, and notifications? This cannot be undone.",
                )
              )
                return;
              setBusy(true);
              try {
                await api("/api/me", "DELETE");
                window.location.assign("/");
              } catch (e) {
                setMessage((e as Error).message);
                setBusy(false);
              }
            }}
          >
            Clear my data
          </button>
        </section>
      )}
    </>
  );
}
