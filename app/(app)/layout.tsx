"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui/client";
import s from "@/components/ui/attendee.module.css";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const poll = () =>
      api<{ notifications: { read: boolean }[] }>("/api/notifications")
        .then((v) => setUnread(v.notifications.filter((n) => !n.read).length))
        .catch(() => {});
    poll();
    const timer = setInterval(poll, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={s.shell}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <header className={s.header}>
        <Link href="/" className={s.brand}>
          ◉ affinity<span> KUBECON NA · 2026</span>
        </Link>
        <Link
          href="/tables#notifications"
          aria-label={`Notifications, ${unread} unread`}
        >
          🔔 {unread > 0 ? unread : ""}
          <span> Notifications</span>
        </Link>
      </header>
      <main id="main" className={`${s.main} ${path === "/map" ? s.mapMain : ""}`}>
        {children}
      </main>
      <nav className={s.nav} aria-label="Main navigation">
        {[
          ["/", "Home"],
          ["/map", "Map"],
          ["/plan", "Plan"],
          ["/tables", "Tables"],
          ["/me", "Me"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
