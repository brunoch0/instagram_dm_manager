"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/AccountProvider";
import { EscalationTag } from "@/components/Badge";

interface DashboardData {
  kpi: { scheduled_today: number; new_conversations_today: number; converted_total: number };
  escalations: Array<{ id: string; username: string | null; ig_user_id: string; escalation_reason: string | null; escalated_at: string }>;
  failed_posts: Array<{ id: string; caption: string | null; scheduled_at: string; error_message: string | null }>;
}

export default function DashboardPage() {
  const { account } = useAccount();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!account) return;
    fetch(`/api/dashboard?account_id=${account.id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  };

  useEffect(load, [account]);

  const ackEscalation = async (contactId: string) => {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contactId, escalation_ack: true }),
    });
    load();
  };

  if (error) return <div className="rounded-lg bg-red-950 p-4 text-red-200">불러오기 실패: {error}</div>;
  if (!data) return <div className="animate-pulse text-zinc-500">로딩 중…</div>;

  const kpis = [
    { label: "오늘 발행 예정", value: data.kpi.scheduled_today, href: "/schedule" },
    { label: "오늘 신규 대화", value: data.kpi.new_conversations_today, href: "/inbox" },
    { label: "전환 (converted)", value: data.kpi.converted_total, href: "/funnels" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">대시보드</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => router.push(k.href)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left hover:border-zinc-600"
          >
            <div className="text-xs text-zinc-400">{k.label}</div>
            <div className="mt-1 text-2xl font-bold">{k.value}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Escalations */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">⚠️ 에스컬레이션 (미확인)</h2>
          {data.escalations.length === 0 ? (
            <p className="text-sm text-zinc-500">미확인 에스컬레이션이 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {data.escalations.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 p-3">
                  <button onClick={() => router.push(`/inbox?contact=${e.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <EscalationTag reason={e.escalation_reason} />
                    <span className="truncate text-sm">@{e.username ?? e.ig_user_id}</span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-500">
                      {new Date(e.escalated_at).toLocaleString("ko", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                  <button onClick={() => ackEscalation(e.id)} className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
                    확인
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Failed posts */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">🚨 발행 실패</h2>
          {data.failed_posts.length === 0 ? (
            <p className="text-sm text-zinc-500">실패한 포스트가 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {data.failed_posts.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => router.push(`/schedule?post=${p.id}`)}
                    className="w-full rounded-lg bg-zinc-950 p-3 text-left hover:bg-zinc-800"
                  >
                    <div className="truncate text-sm">{p.caption || "(캡션 없음)"}</div>
                    <div className="mt-1 truncate text-xs text-red-400">{p.error_message}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      예약: {new Date(p.scheduled_at).toLocaleString("ko")}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
