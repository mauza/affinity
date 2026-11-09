"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type Interest, type Profile } from "./client";
import { Icon } from "./icon";
import Murmuration from "./murmuration";
import s from "./attendee.module.css";
const starters: Interest[] = [
  {id:"platform-engineering",label:"Platform engineering"}, {id:"ai-inference-agentic",label:"AI & inference"},
  {id:"observability",label:"Observability"}, {id:"security",label:"Security"}, {id:"connectivity",label:"Networking"},
];
export default function ProfileEditor({home=false,onSaved}:{home?:boolean;onSaved?:()=>void}) {
  const router=useRouter();
  const [profile,setProfile]=useState<Profile|null>(null),[loaded,setLoaded]=useState(false);
  const [name,setName]=useState(""),[newcomer,setNewcomer]=useState(false);
  const [text,setText]=useState(""),[selected,setSelected]=useState<Interest[]>([]),[publicIds,setPublicIds]=useState<string[]>([]);
  const [suggestions,setSuggestions]=useState<Interest[]>([]),[refining,setRefining]=useState(false),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const version=useRef(0);
  useEffect(()=>{api<{profile:Profile|null}>("/api/me").then(({profile:p})=>{setProfile(p);if(p){setName(p.display_name||"");setNewcomer(!!p.newcomer);setPublicIds(p.public_interests);setSelected(p.interests.map(id=>({id,label:p.interestLabels?.[id]||id})));}}).catch(()=>setMessage("We couldn't load your interests. Please refresh to try again.")).finally(()=>setLoaded(true));},[]);
  async function refine(value:string,generation:number) {
    setRefining(true);
    try {const r=await api<{interests:Interest[];usedAi:boolean}>("/api/interests/refine","POST",{text:value});if(version.current===generation){setSuggestions(r.interests);if(!r.usedAi)setMessage("AI suggestions are unavailable. Search results are still ready to choose.");}}
    catch {if(version.current===generation)setMessage("AI suggestions are unavailable. You can still select search results.");}
    finally {if(version.current===generation)setRefining(false);}
  }
  useEffect(()=>{
    const generation=++version.current;setRefining(false);setSearching(false);setMessage("");
    if(text.trim().length<2){setSuggestions([]);return;}
    const fast=setTimeout(()=>{setSearching(true);api<{interests:Interest[]}>("/api/interests/suggest?q="+encodeURIComponent(text)).then(r=>{if(version.current===generation)setSuggestions(r.interests);}).catch(()=>{if(version.current===generation)setMessage("Search is unavailable. Try a starting topic below.");}).finally(()=>{if(version.current===generation)setSearching(false);});},250);
    const slow=setTimeout(()=>void refine(text,generation),1400);
    return()=>{clearTimeout(fast);clearTimeout(slow);};
  },[text]);
  async function save() {
    setBusy(true);setMessage("");
    try {await api("/api/me","PUT",{display_name:name||null,public_name:false,newcomer,interests:selected.map(i=>i.id),public_interests:publicIds.filter(id=>selected.some(i=>i.id===id)),raw_text:text});setProfile((await api<{profile:Profile}>("/api/me")).profile);onSaved?.();if(home)router.push("/map");else setMessage("Your interests are saved.");}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  const picks=(text.trim()?suggestions:starters).filter(i=>!selected.some(x=>x.id===i.id));
  const form=<form className={`${s.card} ${s.profileCard}`} onSubmit={e=>{e.preventDefault();void save();}}>
    <h2>{home?"What are you into?":"Your interests"}</h2>
    <textarea className={s.bigInput} aria-label="What are you into?" maxLength={1000} rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Kubernetes, AI infra, my next open-source project…"/>
    <div className={s.suggestLabel} role="status"><Icon name="spark" size={13}/>{refining?"Finding topics…":searching?"Searching…":text.trim()?"Pick what fits":selected.length?"Your topics":"Popular"}</div>
    <div className={s.chips}>{selected.map(i=><button className={s.selectedChip} type="button" key={i.id} aria-pressed="true" aria-label={"Remove "+i.label} onClick={()=>setSelected(selected.filter(x=>x.id!==i.id))}>{i.label}<Icon name="close" size={12}/></button>)}{picks.slice(0,8).map(i=><button type="button" key={i.id} disabled={selected.length>=15} onClick={()=>setSelected([...selected,i])}><Icon name="plus" size={12}/>{i.label}{i.isNew?" · new":""}</button>)}</div>
    {text.trim().length>1&&!searching&&!refining&&!picks.length&&!selected.length&&<p className={s.muted}>No matches yet. Try a shorter topic.</p>}
    <div className={s.formFoot}>
      <details className={s.optional}><summary>More options</summary><label className={s.field}>Display name<input maxLength={40} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label><label className={s.check}><input type="checkbox" checked={newcomer} onChange={e=>setNewcomer(e.target.checked)}/>First KubeCon? Favor smaller gatherings</label></details>
      <button type="submit" disabled={!loaded||busy||selected.length===0} className={s.primary}>{busy?"Saving…":home?"Find my people":"Save"}<Icon name="arrow" size={16}/></button>
    </div>
    {message&&<p role="status" className={s.notice}>{message}</p>}
  </form>;
  return home?<div className={s.home}>
    <section className={s.hero}>
      <Murmuration className={s.heroCanvas}/>
      <div className={s.heroText}>
        <p className={s.kicker}><span className={s.liveDot}/>KubeCon NA 2026 · Salt Lake City</p>
        <h1>Find your <span className={s.grad}>pod</span>.</h1>
        <p className={s.lead}>A live map of where people who share your interests gather.</p>
        <div className={s.heroActions}><Link className={s.primary} href="/map">Open the map<Icon name="arrow" size={16}/></Link><Link className={s.ghost} href="/map?mode=murmuration"><Icon name="play" size={13}/>Watch the replay</Link></div>
      </div>
    </section>
    {form}
    <p className={s.footnote}><Icon name="shield" size={13}/>No sign-up. No location tracking. Anonymous by default.</p>
  </div>:<div className={s.narrow}>
    <header className={s.pageHead}><h1>You</h1></header>
    {form}
    <section className={s.card}>
      <h2>Privacy</h2>
      <ul className={s.plain}><li>Anonymous by default. No sign-up, no location tracking.</li><li>Groups under three show as “a few”.</li><li>Live data is deleted on Nov 19.</li></ul>
      <button type="button" className={s.danger} disabled={busy} onClick={async()=>{if(!confirm("Delete your profile, plans, check-ins, alerts, and notifications? This cannot be undone."))return;setBusy(true);try{await api("/api/me","DELETE");window.location.assign("/");}catch(e){setMessage((e as Error).message);setBusy(false);}}}>Clear my data</button>
    </section>
  </div>;
}
