"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui/client";
import { Icon, PodMark } from "@/components/ui/icon";
import s from "@/components/ui/attendee.module.css";
const links = [
  { href: "/", label: "Discover", icon: "home" },
  { href: "/map", label: "Interest map", icon: "map" },
  { href: "/plan", label: "My agenda", icon: "calendar" },
  { href: "/tables", label: "Find a table", icon: "people" },
  { href: "/me", label: "My interests", icon: "user" },
] as const;
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const poll = () => api<{ notifications: { read: boolean }[] }>("/api/notifications")
      .then(v => setUnread(v.notifications.filter(n => !n.read).length)).catch(() => {});
    void poll(); const timer = setInterval(poll, 30000);
    return () => clearInterval(timer);
  }, []);
  return <div className={s.shell}>
    <a className={s.skip} href="#main">Skip to content</a>
    <header className={s.header}>
      <Link className={s.mobileBrand} href="/" aria-label="Affinity home"><PodMark /><strong>affinity</strong></Link>
      <span className={s.event}><span className={s.liveDot}/>KubeCon + CloudNativeCon<span>North America 2026</span></span>
      <Link className={s.notifications} href="/tables#notifications" aria-label={`Notifications, ${unread} unread`}><Icon name="bell"/>{unread > 0 && <b>{unread}</b>}<span>Notifications</span></Link>
    </header>
    <nav className={s.nav} aria-label="Main navigation">
      <Link href="/" className={s.brand} aria-label="Affinity home"><PodMark/><span>affinity<small>FIND YOUR POD</small></span></Link>
      <p className={s.navCaption}>YOUR CONFERENCE, CONNECTED</p>
      {links.map(({href,label,icon}) => <Link key={href} href={href} aria-current={path===href?"page":undefined}><Icon name={icon}/><span>{label}</span></Link>)}
      <div className={s.navFooter}><span className={s.navFlower}>✳</span><strong>Better, together.</strong><p>A shared interest is all<br/>it takes to say hello.</p><span>Salt Lake City · Nov 9–12</span></div>
    </nav>
    <main id="main" tabIndex={-1} className={`${s.main} ${path==="/map"?s.mapMain:""}`}>{children}</main>
  </div>;
}
