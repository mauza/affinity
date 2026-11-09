"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type Interest, type Profile } from "./client";
import { Icon } from "./icon";
import s from "./attendee.module.css";
const starters: Interest[] = [
  {id:"platform-engineering",label:"Platform engineering"}, {id:"ai-inference-agentic",label:"AI & inference"},
  {id:"observability",label:"Observability"}, {id:"security",label:"Security"}, {id:"connectivity",label:"Networking"},
];
function InterestGarden() {
  return <svg className={s.homeArt} viewBox="0 0 430 230" role="img" aria-label="An illustration of shared interests connecting people">
    <defs><pattern id="gardenDots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d7dfce"/></pattern></defs>
    <rect width="430" height="230" rx="20" fill="url(#gardenDots)"/>
    <g fill="none" stroke="#c0d2b5" strokeWidth="1.2"><ellipse cx="215" cy="115" rx="148" ry="77"/><ellipse cx="215" cy="115" rx="70" ry="104" transform="rotate(48 215 115)"/><path d="M71 94 175 145 308 66 352 156 141 60 215 115 290 183"/></g>
    <g fill="#d7e7c3"><circle cx="71" cy="94" r="12"/><circle cx="175" cy="145" r="15"/><circle cx="308" cy="66" r="18"/><circle cx="352" cy="156" r="10"/><circle cx="141" cy="60" r="9"/><circle cx="290" cy="183" r="12"/></g>
    <circle cx="215" cy="115" r="38" fill="#e7eedc"/><circle cx="215" cy="115" r="27" fill="#276b54"/><text x="215" y="119" fill="white" textAnchor="middle" fontFamily="sans-serif" fontSize="10" letterSpacing="2">YOU</text>
    <g fontSize="10" fontFamily="sans-serif" fill="#42604a"><rect x="23" y="28" width="102" height="26" rx="13" fill="#fff" stroke="#dce5d5"/><text x="74" y="45" textAnchor="middle">Observability</text><rect x="267" y="99" width="106" height="26" rx="13" fill="#fff" stroke="#dce5d5"/><text x="320" y="116" textAnchor="middle">AI infrastructure</text><rect x="95" y="184" width="90" height="26" rx="13" fill="#fff" stroke="#dce5d5"/><text x="140" y="201" textAnchor="middle">Your next hello</text></g>
  </svg>;
}
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
    <div className={s.formStep}>A LITTLE ABOUT YOU<span aria-hidden="true"><i/><i/><i/></span></div>
    <h2>{home?"What brings you here?":"Your interests"}</h2>
    <p className={s.muted}>Tell us what you’re curious about. Find the people who are, too.</p>
    <label className={s.field}>What are you into?<textarea maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder="e.g. Making Kubernetes simpler, AI infrastructure, or my next open-source project"/></label>
    <div className={s.suggestLabel} role="status"><Icon name="spark" size={14}/>{refining?"Finding the right topics for you…":searching?"Searching interests…":selected.length?`${selected.length} ${selected.length===1?"interest":"interests"} selected · add or remove topics`:text.trim()?"Choose the topics that feel like you":"A few places to start"}</div>
    <div className={s.chips}>{selected.map(i=><button className={s.selectedChip} type="button" key={i.id} aria-pressed="true" aria-label={"Remove "+i.label} onClick={()=>setSelected(selected.filter(x=>x.id!==i.id))}><Icon name="check" size={13}/>{i.label}<Icon name="close" size={12}/></button>)}{picks.slice(0,8).map(i=><button type="button" key={i.id} disabled={selected.length>=15} onClick={()=>setSelected([...selected,i])}>+ {i.label}{i.isNew?" · new":""}</button>)}</div>
    {text.trim().length>1&&!searching&&!refining&&!picks.length&&!selected.length&&<p className={s.muted}>No matches yet. Try a shorter topic, or refine your interests.</p>}

    <button type="submit" disabled={!loaded||busy||selected.length===0} className={`${s.primary} ${s.fullButton}`}>{busy?"Saving your interests…":home?"Find my people":"Save my interests"}<Icon name="arrow" size={17}/></button>
    {!selected.length&&<p className={s.muted} style={{textAlign:"center",margin:"8px 0 0"}}>Choose a topic above to get started.</p>}
    <p className={s.privacyNote}><Icon name="shield" size={14}/>No sign-up. No location tracking. You choose when to check in.</p>
    <details className={s.optional}><summary>A little more about you <span>(optional)</span></summary><label className={s.field}>Display name<input maxLength={40} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label><p className={s.muted}>For your own profile; your name won’t appear on the public map.</p><label className={s.check}><input type="checkbox" checked={newcomer} onChange={e=>setNewcomer(e.target.checked)}/>I’m new here and would welcome a smaller gathering</label></details>
    {message&&<p role="status" className={s.notice}>{message}</p>}
  </form>;
  return home?<div className={s.homeGrid}><section className={s.homeHero}><span className={s.eyebrow}>KUBECON NA · SALT LAKE CITY</span><h1>Your people.<span className={s.heroMiddle}><br/>Your place.</span><br/><em>Your next hello.</em></h1><p className={s.lead}>A whole conference of possibilities. Find the talks, tables, and people who share your curiosity.</p><div className={s.heroLinks}><Link href="/map">Explore the interest map <Icon name="arrow" size={16}/></Link><Link href="/map?mode=murmuration">Watch the day unfold <Icon name="play" size={13}/></Link></div><InterestGarden/><div className={s.heroFacts}><span><strong>600</strong>sessions to discover</span><span><strong>4 floors</strong>of shared curiosity</span><span><strong>One hello</strong>is all it takes</span></div></section>{form}</div>:<div className={s.profileLayout}><span className={s.eyebrow}>MAKE THIS CONFERENCE YOURS</span><h1>A little more you.</h1><p className={s.lead}>Update your interests. Keep control of what you share.</p>{form}<section className={s.card}><h2>Privacy, in plain language</h2><p className={s.muted}>The map shows anonymous interest patterns, never individual histories. Groups smaller than three appear as “a few”. Topics are shared when you choose to be open to connect. Simulated attendees are labeled.</p><p className={s.muted}>Live data is deleted on November 19, 2026. You can delete your profile, agenda, check-ins and alerts now.</p><button type="button" className={s.danger} disabled={busy} onClick={async()=>{if(!confirm("Delete your profile, plans, check-ins, alerts, and notifications? This cannot be undone."))return;setBusy(true);try{await api("/api/me","DELETE");window.location.assign("/");}catch(e){setMessage((e as Error).message);setBusy(false);}}}>Clear my data</button></section></div>;
}
