"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui/client";
import { Icon, PodMark } from "@/components/ui/icon";
import s from "@/components/ui/attendee.module.css";
const links = [
  { href: "/", label: "Discover", icon: "home" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/plan", label: "Agenda", icon: "calendar" },
  { href: "/tables", label: "Tables", icon: "people" },
  { href: "/me", label: "You", icon: "user" },
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
    <header className={s.topbar}>
      <Link className={s.brand} href="/" aria-label="Affinity home"><PodMark /><span>affinity</span></Link>
      <Link className={s.bell} href="/tables#notifications" aria-label={`Notifications, ${unread} unread`}><Icon name="bell" size={19}/>{unread > 0 && <b>{unread}</b>}</Link>
    </header>
    {/* Outside the header: on phones it becomes a fixed bottom tab bar. */}
    <nav className={s.nav} aria-label="Main navigation">
      {links.map(({ href, label, icon }) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}><Icon name={icon} size={18}/><span>{label}</span></Link>)}
    </nav>
    <main id="main" tabIndex={-1} className={`${s.main} ${path === "/map" ? s.mapMain : ""}`}>{children}</main>
  </div>;
}
