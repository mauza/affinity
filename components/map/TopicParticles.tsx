"use client";

import { useEffect, useMemo, useRef } from "react";
import { particleFill, roomParticles, type ReplayTopic } from "./topic-particles";
import s from "./map.module.css";

export function TopicParticles({ zone, rect, topics, values, bucket, weight, animate = true }: {
  zone: string; rect: number[]; topics: ReplayTopic[]; values: Record<string, number[]>;
  bucket: number; weight: number; animate?: boolean;
}) {
  const particles = useMemo(() => roomParticles(zone, rect, values, weight), [zone, rect, values, weight]);
  const colors = useMemo(() => Object.fromEntries(topics.map(topic => [topic.id, topic.color])), [topics]);
  const previousBucket = useRef(bucket);
  const previous = previousBucket.current;
  useEffect(() => { previousBucket.current = bucket; }, [bucket]);
  return <g pointerEvents="none" aria-hidden="true" className={`${s.topicParticles} ${animate ? "" : s.stillParticles}`}>
    {particles.filter(p => p.slot < Math.ceil(Math.max(values[p.topic]?.[bucket] ?? 0, values[p.topic]?.[previous] ?? 0) / weight)).map(p => {
      const count = values[p.topic]?.[bucket] ?? 0, fill = particleFill(count, p.slot, weight);
      const few = p.slot === 0 && count > 0 && count < 3;
      return <g key={`${p.topic}:${p.slot}`} fill={colors[p.topic] ?? "#5eead4"}>
        <circle cx={p.x} cy={p.y} r={p.radius * Math.sqrt(fill)} opacity={fill > 0 ? .9 : 0} className={s.topicCircle}/>
        {p.slot === 0 && <g opacity={few ? .75 : 0} className={s.fewCloud}>
          <circle cx={p.x - p.radius * .32} cy={p.y + p.radius * .16} r={p.radius * .72}/>
          <circle cx={p.x + p.radius * .32} cy={p.y + p.radius * .16} r={p.radius * .72}/>
          <circle cx={p.x} cy={p.y - p.radius * .32} r={p.radius * .72}/>
        </g>}
      </g>;
    })}
  </g>;
}

export function TopicLegend({ topics, weight }: { topics: ReplayTopic[]; weight: number }) {
  return <div className={s.topicLegend} aria-label="Topic color legend">
    <div className={s.topicScale}><strong><i/>Topic check-ins</strong><span>{weight === 1 ? "1 circle = 1 topic check-in" : `Scaled · full circle = ${weight} topic check-ins; smaller = remainder`}</span><span><i className={s.cloudKey}/>A few · privacy protected</span></div>
    <p>Colors show shared interests. Someone can appear in several colors. Room badges count people.</p>
    <details><summary>Topic colors <span>{topics.length} official conference tracks</span></summary><ul>{topics.map(topic => <li key={topic.id}><i style={{ background: topic.color }}/>{topic.label}</li>)}</ul></details>
  </div>;
}

export function RoomTopicCounts({ topics, values, bucket }: { topics: ReplayTopic[]; values: Record<string, number[]>; bucket: number }) {
  const active = topics.map(topic => ({ ...topic, count: values[topic.id]?.[bucket] ?? 0 })).filter(topic => topic.count > 0).sort((a, b) => b.count - a.count);
  return <section className={s.roomTopics} aria-label="Replayed topic check-ins">
    <h3>Topic check-ins</h3>
    {active.length ? <ul>{active.map(topic => <li key={topic.id}><span><i style={{ background: topic.color }}/>{topic.label}</span><strong>{topic.count < 3 ? "a few" : topic.count}</strong></li>)}</ul> : <p className={s.muted}>No topic check-ins in this frame.</p>}
  </section>;
}
