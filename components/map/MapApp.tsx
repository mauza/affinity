"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/icon";
import { clock, countLabel, FloorMap, get, Legend, type Meta, type Zone, type Series, type TopicTable, type Insight } from "./shared";
import s from "./map.module.css";
import { RoomTopicCounts, TopicLegend } from "./TopicParticles";
import { topicParticleWeight } from "./topic-particles";
import { useReplayMotion } from "./replay-motion";
const modes={now:"Here now",open:"Open to connect",planned:"Planned",murmuration:"Day replay"};
const shortModes={now:"Now",open:"Open",planned:"Planned",murmuration:"Replay"};
const eventDays=[["2026-11-09","Mon 9"],["2026-11-10","Tue 10"],["2026-11-11","Wed 11"],["2026-11-12","Thu 12"]];
const roomGroups:[string,string[]][]=[["Session rooms",["session"]],["Expo, theaters & meals",["expo","meal"]],["Lounges & quiet spaces",["lounge","quiet"]],["Meeting rooms",["meeting","facility"]],["Hallways & entrances",["hallway"]]];
const byName=(a:{name:string},b:{name:string})=>a.name.localeCompare(b.name,undefined,{numeric:true});
type Mode=keyof typeof modes;
type Profile={interests:string[];interestLabels:Record<string,string>};
type Stint={zone:string;active:{lt:string}};
const descriptions:Record<Mode,string>={now:"Who’s checked in right now.",open:"People open to a conversation.",planned:"Where people plan to be.",murmuration:"A day of shared interests, five minutes at a time."};
export default function MapApp(){
  const [meta,setMeta]=useState<Meta>(),[profile,setProfile]=useState<Profile|null>(null);
  const [mode,setMode]=useState<Mode>("now"),[floor,setFloor]=useState("sp1"),[list,setList]=useState(false),[zoom,setZoom]=useState(1);
  const [live,setLive]=useState(false),[filters,setFilters]=useState<string[]>([]),[day,setDay]=useState(""),[replayDay,setReplayDay]=useState("2026-11-10");
  const [minute,setMinute]=useState(720),[bucket,setBucket]=useState(108),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(300);
  const [counts,setCounts]=useState<Record<string,number>>({}),[series,setSeries]=useState<Series>();
  const [selected,setSelected]=useState<Zone>(),[tables,setTables]=useState<TopicTable[]>([]),[insights,setInsights]=useState<Insight[]>([]),[labels,setLabels]=useState<Record<string,string>>({});
  const [topics,setTopics]=useState<string[]>([]),[hint,setHint]=useState(""),[stint,setStint]=useState<Stint|null>(null);
  const [updated,setUpdated]=useState(0),[now,setNow]=useState(0),[revision,refresh]=useState(0),[error,setError]=useState(""),[detailError,setDetailError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const mapScroll=useRef<HTMLDivElement>(null), autoStarted=useRef(false), manualFloor=useRef(false);
  const {visible,reducedMotion}=useReplayMotion(mapScroll,!list);
  const dialog=useRef<HTMLDialogElement>(null), panel=useRef<HTMLElement>(null), roomPicker=useRef<HTMLSelectElement>(null), returnFocus=useRef<HTMLElement|null>(null);
  function chooseZone(zone:Zone,trigger?:HTMLElement){returnFocus.current=trigger??roomPicker.current;setSelected(zone);setNotice("");if(window.matchMedia("(max-width: 1000px)").matches)setZoom(z=>Math.max(z,2));}
  function chooseFloor(id:string){manualFloor.current=true;setFloor(id);setZoom(1);setPlaying(false);}
  function closeDetails(){setSelected(undefined);setNotice("");dialog.current?.close();(returnFocus.current??roomPicker.current)?.focus({preventScroll:true});}
  useEffect(()=>{
    const c=new AbortController();setNow(Date.now());
    get<Meta>("/api/meta",c.signal).then(m=>{setMeta(m);setDay(m.today);setMinute(Number(clock(m.now).slice(0,2))*60+Number(clock(m.now).slice(3)));const q=new URLSearchParams(window.location.search);const requestedDay=q.get("day");if(eventDays.some(([d])=>d===requestedDay))setReplayDay(requestedDay!);const z=m.zones.find(z=>z.id===q.get("zone"));if(z){manualFloor.current=true;setSelected(z);setFloor(z.floor);}const requested=q.get("mode");if(requested&&Object.hasOwn(modes,requested))setMode(requested as Mode);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    get<{profile:Profile|null}>("/api/me",c.signal).then(r=>setProfile(r.profile)).catch(()=>{});
    get<{interests:{id:string;label:string}[]}>("/api/interests/all",c.signal).then(r=>setLabels(Object.fromEntries(r.interests.map(i=>[i.id,i.label])))).catch(()=>{});
    const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{c.abort();clearInterval(timer);};
  },[]);
  useEffect(()=>{
    if(!day)return;const c=new AbortController();
    const load=async()=>{try{const q=new URLSearchParams({...live?{live:"1"}:{},interests:filters.join(",")});if(mode==="murmuration"){q.set("day",replayDay);q.set("kind","presence");setSeries(await get<Series>("/api/murmuration?"+q,c.signal));}else{q.set("mode",mode);if(mode==="planned")q.set("at",`${day}T${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}:00-07:00`);setCounts((await get<{counts:Record<string,number>}>("/api/map?"+q,c.signal)).counts);}setUpdated(Date.now());setError("");}catch(e){if(!c.signal.aborted)setError((e as Error).message);}};
    setCounts({});setSeries(undefined);setUpdated(0);void load();const timer=setInterval(load,15000);return()=>{c.abort();clearInterval(timer);};
  },[mode,day,replayDay,minute,live,filters,revision]);
  // Bring the selected room into view whenever the map is zoomed in (scrolls the map and, on phones, the page).
  useEffect(()=>{if(!selected||selected.floor!==floor||zoom<=1)return;const id=requestAnimationFrame(()=>mapScroll.current?.querySelector(`[data-zone="${selected.id}"]`)?.scrollIntoView({block:"center",inline:"center",behavior:reducedMotion?"auto":"smooth"}));return()=>cancelAnimationFrame(id);},[selected,zoom,floor,reducedMotion]);
  // The replay starts itself from 08:00; with reduced motion it jumps to the busiest moment instead.
  useEffect(()=>{if(mode!=="murmuration"||!series?.times.length||series.day!==replayDay||autoStarted.current)return;autoStarted.current=true;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){let best=96,top=-1;for(let i=96;i<=227;i++){const t=Object.values(series.zones).reduce((a,v)=>a+(v[i]??0),0);if(t>top){top=t;best=i;}}setBucket(best);}
    else{setBucket(96);setPlaying(true);}
  },[mode,series,replayDay]);
  useEffect(()=>{if(reducedMotion)setPlaying(false);},[reducedMotion]);
  useEffect(()=>{if(!playing||!visible||reducedMotion||mode!=="murmuration"||!series?.times.length||series.day!==replayDay)return;const timer=setInterval(()=>setBucket(b=>b>=227?96:b+1),speed);return()=>clearInterval(timer);},[playing,visible,reducedMotion,mode,series,replayDay,speed]);
  useEffect(()=>{if(mode==="murmuration"&&!manualFloor.current){setFloor(replayDay==="2026-11-09"?"hy4":"sp1");setZoom(1);}},[mode,replayDay]);
  useEffect(()=>{
    const c=new AbortController();setTables([]);setInsights([]);setDetailError("");
    get<{stint:Stint|null}>("/api/presence",c.signal).then(r=>setStint(r.stint)).catch(()=>{});
    if(selected)Promise.all([get<{tables:TopicTable[]}>(`/api/tables?zone=${selected.id}${live?"&live=1":""}`,c.signal),get<{insights:Insight[]}>(`/api/insights?kind=zone&zone=${selected.id}${live?"&live=1":""}`,c.signal)]).then(([t,i])=>{setTables(t.tables);setInsights(i.insights);}).catch(e=>{if(!c.signal.aborted)setDetailError(e.message);});
    return()=>c.abort();
  },[selected,live,revision]);
  useEffect(()=>{const viewport=window.matchMedia("(max-width: 1000px)");
    const sync=()=>{const d=dialog.current;if(selected&&viewport.matches){if(!d?.open){returnFocus.current??=roomPicker.current;d?.showModal();}}else if(d?.open)d.close();
      if(selected&&!viewport.matches)panel.current?.focus();};
    sync();viewport.addEventListener("change",sync);return()=>viewport.removeEventListener("change",sync);
  },[selected]);
  async function action(action:"checkin"|"renew"|"leave",open=false){setBusy(true);setNotice("");try{const r=await fetch("/api/presence",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...action==="checkin"?{zone:selected?.id,openTopics:open?topics:[],hint:open?hint:""}:{}})});const body=await r.json();if(!r.ok)throw new Error(body.error||"Could not update presence");setStint(body.stint);refresh(v=>v+1);setNotice(action==="leave"?"You’ve left this space.":"You’re checked in for 30 minutes.");}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
  const shown=mode==="murmuration"?Object.fromEntries(Object.entries(series?.zones??{}).map(([id,values])=>[id,values[bucket]??0])):counts;
  const toggle=(id:string,values:string[],setter:(v:string[])=>void)=>setter(values.includes(id)?values.filter(v=>v!==id):values.length<3?[...values,id]:values);
  const activeFloor=meta?.floors.find(f=>f.id===floor);
  const visibleZones=meta?.zones.filter(z=>z.floor===floor)??[];
  const ranked=[...visibleZones].sort((a,b)=>(shown[b.id]??0)-(shown[a.id]??0));
  const timeLabel=mode==="planned"?`${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`:series?.times[bucket]?clock(series.times[bucket]):"09:00";
  const peak=mode==="murmuration"?Math.max(3,series?.peak??30):30;
  const particleWeight=useMemo(()=>topicParticleWeight(series?.zoneTopics),[series?.zoneTopics]);
  const topicReplay=mode==="murmuration"&&series?.topics&&series.zoneTopics?{topics:series.topics,zoneTopics:series.zoneTopics,bucket,weight:particleWeight,animate:visible&&!reducedMotion}:undefined;
  const details=<>{selected&&<><button className={s.close} aria-label="Close zone details" onClick={closeDetails}><Icon name="close" size={17}/></button><p className={s.eyebrow}>{meta?.floors.find(f=>f.id===selected.floor)?.name}</p><h2>{selected.name}</h2><div className={s.roomCount}>{updated?countLabel(shown[selected.id]??0):"—"}<span>{modes[mode].toLowerCase()}{mode==="murmuration"?` · ${timeLabel} MST`:""}</span></div>{selected.note&&<p className={s.muted}>{selected.note}</p>}
    {mode!=="murmuration"&&<><h3>Tables here</h3>{detailError&&<p role="alert" className={s.error}>{detailError}</p>}{!tables.length&&<p className={s.muted}>None yet. Start one below.</p>}{tables.map(t=><article key={t.id} className={s.card}><strong>{labels[t.topic]||t.topic}</strong><span>{countLabel(t.count)} open to connect</span><p>{t.hint||"Everyone is welcome."}</p></article>)}
    {updated&&(shown[selected.id]??0)>=3&&insights.length>0&&<><h3>Popular here</h3>{insights.map(i=><p key={i.interest} className={s.muted}>{labels[i.interest]||i.interest} · {i.ratio.toFixed(1)}× more popular</p>)}</>}
    </>}{topicReplay&&selected&&<RoomTopicCounts topics={topicReplay.topics} values={topicReplay.zoneTopics[selected.id]??{}} bucket={bucket}/>}
    <div className={s.joinSpace}>{stint?.zone===selected.id?<p className={s.muted}>You’re checked in here.</p>:profile?<><p className={s.muted}>Anonymous · lasts 30 minutes</p><button className={s.primary} disabled={busy} onClick={()=>void action("checkin")}>Check in here <Icon name="pin" size={15}/></button><details className={s.connect}><summary>Open to talk about…</summary><p className={s.muted}>Up to 3 topics.</p><div className={s.tabs}>{profile.interests.map(id=><button key={id} disabled={!topics.includes(id)&&topics.length===3} aria-pressed={topics.includes(id)} onClick={()=>toggle(id,topics,setTopics)}>{profile.interestLabels[id]||id}</button>)}</div><label>Meetup spot<input className={s.hint} maxLength={80} value={hint} placeholder="By the coffee station" onChange={e=>setHint(e.target.value)}/></label><button className={s.primary} disabled={busy||!topics.length} onClick={()=>void action("checkin",true)}>Open to connect here</button></details></>:<><Link className={s.primary} href="/">Add interests to check in <Icon name="arrow" size={16}/></Link></>}</div></>}{stint&&<div className={s.stint}><strong><span className={s.dot}/>You’re checked in</strong><p>{meta?.zones.find(z=>z.id===stint.zone)?.name||stint.zone}</p><small>Until {clock(stint.active.lt)} MST</small><div className={s.tabs}><button disabled={busy} onClick={()=>void action("renew")}>Stay another 30 min</button><button disabled={busy} onClick={()=>void action("leave")}>Leave</button></div></div>}{notice&&<p role="status" className={s.notice}>{notice}</p>}</>;
  return <div className={s.app}>
    <h1 className={s.srOnly}>Interest map</h1>
    <div className={s.toolbar}><div className={s.modeTabs} aria-label="Map mode">{Object.entries(modes).map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>{if(id==="murmuration"&&mode!==id)autoStarted.current=false;setMode(id as Mode);setPlaying(false);}}><span className={s.long}>{label}</span><span className={s.short}>{shortModes[id as Mode]}</span>{id==="murmuration"&&<Icon name="play" size={12}/>}</button>)}</div>
    <details className={s.mapOptions}><summary>Filters <span>{[filters.length?`${filters.length} interest${filters.length>1?"s":""}`:"",live?"Live attendees only":"Includes simulated attendees"].filter(Boolean).join(" · ")}</span></summary><label className={s.toggle}><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>Live attendees only · exclude simulated attendees</label><div className={s.filterBar}><div className={s.tabs}><span className={s.filterLabel}>MATCH ANY · UP TO 3</span>{profile?.interests.length?profile.interests.map(id=><button key={id} disabled={!filters.includes(id)&&filters.length===3} aria-pressed={filters.includes(id)} onClick={()=>toggle(id,filters,setFilters)}>{profile.interestLabels[id]||id}</button>):<Link href="/">Personalize your map <Icon name="arrow" size={13}/></Link>}{filters.length>0&&<button onClick={()=>setFilters([])}>Clear filters</button>}</div></div></details></div>
    <p className={s.modeLine}>{descriptions[mode]}</p>
    {(mode==="planned"||mode==="murmuration")&&<section className={s.player} aria-label="Timeline controls"><div className={s.days} role="group" aria-label="Day">{eventDays.map(([d,l])=><button key={d} aria-pressed={(mode==="planned"?day:replayDay)===d} onClick={()=>{if(mode==="planned")setDay(d);else{autoStarted.current=false;setPlaying(false);setReplayDay(d);setBucket(96);}}}>{l}</button>)}</div>{mode==="murmuration"&&<><button className={s.primary} disabled={!series||reducedMotion} title={reducedMotion?"Reduced motion is on. Use the timeline to explore static frames.":undefined} onClick={()=>setPlaying(!playing)}>{reducedMotion?"Static frame":playing?"Pause":"Play"}{!reducedMotion&&" flow"}</button><label className={s.speed}>Speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={650}>Slow</option><option value={300}>Normal</option><option value={100}>Fast</option></select></label></>}<input aria-label={mode==="planned"?"Planned time":"Replay time"} className={s.scrub} type="range" min={mode==="planned"?0:96} max={mode==="planned"?1435:227} step={mode==="planned"?5:1} value={mode==="planned"?minute:bucket} onChange={e=>{if(mode==="planned")setMinute(Number(e.target.value));else{setPlaying(false);setBucket(Number(e.target.value));}}}/><strong>{timeLabel}<small>MST</small></strong></section>}
    {error&&<p role="alert" className={s.error}>Map unavailable. {error} · Retrying every 15 seconds.</p>}
    <div className={s.workspace}><section className={s.canvas} aria-label="Conference interest map"><div className={s.canvasTop}><label className={s.floorSelect}>Floor<select value={floor} onChange={e=>chooseFloor(e.target.value)}>{meta?.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className={s.floorTabs} aria-label="Floor">{meta?.floors.map(f=><button key={f.id} aria-pressed={floor===f.id} onClick={()=>chooseFloor(f.id)}>{f.name}</button>)}</div><button className={s.viewButton} aria-pressed={list} onClick={()=>setList(!list)}>{list?"Map view":"Room list"}</button></div>
    <div className={s.mapMeta}><label className={s.quickRoom}><span>Choose a room</span><select ref={roomPicker} aria-label="Jump to a room" value={selected?.floor===floor?selected.id:""} onChange={e=>{const z=visibleZones.find(z=>z.id===e.target.value);if(z)chooseZone(z,e.currentTarget);}}><option value="">Jump to a room or shared space</option>{roomGroups.map(([group,kinds])=>{const zs=visibleZones.filter(z=>kinds.includes(z.kind)).sort(byName);return zs.length?<optgroup key={group} label={group}>{zs.map(z=><option key={z.id} value={z.id}>{z.name}{(shown[z.id]??0)>0?` · ${countLabel(shown[z.id])}`:""}</option>)}</optgroup>:null;})}</select></label>{!list&&<div className={s.zoom}><button disabled={zoom===1} aria-label="Zoom out" onClick={()=>setZoom(Math.max(1,zoom-.5))}>−</button><span>{Math.round(zoom*100)}%</span><button disabled={zoom>=3} aria-label="Zoom in" onClick={()=>setZoom(Math.min(3,zoom+.5))}>+</button></div>}</div>
    {!updated&&!error&&<div className={s.loading} role="status">Finding the flow of the conference…</div>}
    {list?<div className={s.roomList}>{ranked.map(z=><button key={z.id} aria-pressed={selected?.id===z.id} onClick={e=>chooseZone(z,e.currentTarget)}><span><span className={s.roomKind}>{z.kind}</span><strong>{z.name}</strong></span><span className={s.roomNumber}>{updated?countLabel(shown[z.id]??0):"—"}<Icon name="arrow" size={14}/></span></button>)}</div>:<div ref={mapScroll} className={s.mapScroll} tabIndex={0} aria-label="Venue map · zoom in for room labels, then scroll to explore"><div style={{width:`min(${zoom*100}%, ${620*(activeFloor?activeFloor.viewBox[2]/activeFloor.viewBox[3]:1)*zoom}px)`,marginInline:"auto"}}>{meta?.floors.filter(f=>f.id===floor).map(f=><FloorMap key={`${f.id}:${topicReplay?series?.day:mode}`} floor={f} zones={meta.zones} counts={shown} mode={modes[mode]} peak={peak} selected={selected?.id} onSelect={z=>chooseZone(z)} topicReplay={topicReplay}/>)}</div></div>}
    <div className={s.mapFooter}>{topicReplay?<TopicLegend topics={topicReplay.topics} weight={particleWeight}/>:<Legend peak={peak}/>}<span>{updated?`Updated ${Math.max(0,Math.floor((now-updated)/1000))}s ago`:"Connecting…"} · <a href="https://events.linuxfoundation.org/kcna26-venue-map" target="_blank" rel="noreferrer">Venue map © The Linux Foundation</a></span></div>
    </section><aside ref={panel} tabIndex={-1} className={s.panel} aria-label={selected?`Details for ${selected.name}`:"Conference context"}>{selected?details:<><p className={s.eyebrow}>{mode==="murmuration"?`${timeLabel} MST`:modes[mode]}</p><h2>Busiest on this floor</h2><div className={s.hotspots}>{ranked.filter(z=>(shown[z.id]??0)>0).slice(0,3).map(z=><button key={z.id} onClick={e=>chooseZone(z,e.currentTarget)}><span>{z.name.split(" · ")[0]}</span><strong>{countLabel(shown[z.id]??0)}<Icon name="arrow" size={13}/></strong></button>)}</div>{!ranked.some(z=>(shown[z.id]??0)>0)&&<p className={s.muted}>Quiet here. Try another floor{mode==="murmuration"?" or time":""}, or tap a room.</p>}<details className={s.facilities}><summary>Facilities</summary>{meta?.facilities.map((f,i)=><p key={i}><strong>{f.name}</strong><br/>{f.where}</p>)}</details>{stint&&details}</>}</aside></div>
    <dialog ref={dialog} className={s.sheet} aria-label={selected?.name??"Zone details"} aria-modal="true" onCancel={e=>{e.preventDefault();closeDetails();}} onKeyDown={e=>{
      if(e.key!=="Tab")return;
      const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')).filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }} onClick={e=>{if(e.target===e.currentTarget)closeDetails();}}>{details}</dialog>
  </div>;
}
