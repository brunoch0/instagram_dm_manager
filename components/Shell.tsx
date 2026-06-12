"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "./AccountProvider";

const TABS = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/schedule", label: "스케줄", icon: "🗓️" },
  { href: "/funnels", label: "퍼널", icon: "🎯" },
  { href: "/inbox", label: "인박스", icon: "💬" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { accounts, account, setAccountId } = useAccount();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!account) return;
    fetch(`/api/dashboard?account_id=${account.id}`)
      .then((r) => r.json())
      .then((d) => setAlertCount((d.escalations?.length ?? 0) + (d.failed_posts?.length ?? 0)))
      .catch(() => {});
  }, [account, pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-52 shrink-0 border-r border-zinc-800 md:block">
        <div className="px-4 py-5 text-sm font-bold tracking-wide text-zinc-300">
          IG Automation OS
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                pathname.startsWith(tab.href)
                  ? "bg-zinc-800 font-medium text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.href === "/dashboard" && alertCount > 0 && (
                <span className="ml-auto rounded-full bg-red-600 px-1.5 text-xs">{alertCount}</span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="text-sm font-bold md:hidden">IG Automation OS</div>
          <select
            value={account?.id ?? ""}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={accounts.length <= 1}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-70"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.unit_name} (@{a.ig_username})
              </option>
            ))}
            {accounts.length === 0 && <option value="">계정 없음</option>}
          </select>
          <Link href="/dashboard" className="relative text-lg" title="알림">
            🔔
            {alertCount > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1.5 text-xs font-bold">
                {alertCount}
              </span>
            )}
          </Link>
        </header>

        <main className="min-w-0 flex-1 p-4 pb-20 md:pb-4">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-zinc-800 bg-zinc-950 md:hidden">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center py-2 text-xs ${
              pathname.startsWith(tab.href) ? "text-white" : "text-zinc-500"
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
