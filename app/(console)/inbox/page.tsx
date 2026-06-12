"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/components/AccountProvider";
import { ContactStatusBadge, EscalationTag } from "@/components/Badge";
import { DM_WINDOW_MS } from "@/lib/dm-guard";

interface Contact {
  id: string;
  username: string | null;
  ig_user_id: string;
  language: string | null;
  last_message_at: string | null;
  status: string;
  escalated: boolean;
  escalation_reason: string | null;
  escalation_ack: boolean;
  last_message_preview: string;
  funnels: { name: string } | null;
}

interface Message {
  id: string;
  direction: "in" | "out";
  text: string | null;
  created_at: string;
  funnels: { name: string } | null;
}

function remainingWindow(lastMessageAt: string | null): number {
  if (!lastMessageAt) return 0;
  return Math.max(0, new Date(lastMessageAt).getTime() + DM_WINDOW_MS - Date.now());
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function InboxPageInner() {
  const { account } = useAccount();
  const params = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [filter, setFilter] = useState<"all" | "escalated" | "active" | "converted">("all");
  const [search, setSearch] = useState("");

  const load = () => {
    if (!account) return;
    const qs = new URLSearchParams({ account_id: account.id });
    if (filter === "escalated") qs.set("escalated", "true");
    else if (filter !== "all") qs.set("status", filter);
    fetch(`/api/contacts?${qs}`)
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []));
  };

  useEffect(load, [account, filter]);

  // deep-link (?contact=id)
  useEffect(() => {
    const cid = params.get("contact");
    if (cid && contacts.length && !selected) {
      const c = contacts.find((x) => x.id === cid);
      if (c) setSelected(c);
    }
  }, [params, contacts, selected]);

  const visible = contacts.filter(
    (c) => !search || (c.username ?? c.ig_user_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-3 md:h-[calc(100vh-5.5rem)]">
      {/* List pane */}
      <div className={`w-full flex-col md:flex md:w-80 md:shrink-0 ${selected ? "hidden" : "flex"}`}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="username 검색"
          className="mb-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <div className="mb-2 flex gap-1 text-xs">
          {([["all", "전체"], ["escalated", "⚠️ 에스컬"], ["active", "active"], ["converted", "converted"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-2.5 py-1 ${filter === key ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {visible.length === 0 && <li className="p-4 text-center text-sm text-zinc-500">대화가 없습니다</li>}
          {visible.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className={`w-full rounded-lg p-3 text-left hover:bg-zinc-900 ${selected?.id === c.id ? "bg-zinc-900" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">@{c.username ?? c.ig_user_id}</span>
                  {c.escalated && !c.escalation_ack && <span title="에스컬레이션">⚠️</span>}
                  <span className="ml-auto shrink-0 text-xs text-zinc-500">
                    {c.last_message_at && new Date(c.last_message_at).toLocaleString("ko", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{c.last_message_preview}</span>
                  <ContactStatusBadge status={c.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Thread pane */}
      <div className={`min-w-0 flex-1 flex-col md:flex ${selected ? "flex" : "hidden"}`}>
        {selected ? (
          <Thread contact={selected} onBack={() => { setSelected(null); load(); }} onContactChange={(c) => { setSelected(c); load(); }} />
        ) : (
          <div className="hidden flex-1 items-center justify-center text-sm text-zinc-600 md:flex">대화를 선택하세요</div>
        )}
      </div>
    </div>
  );
}

function Thread({ contact, onBack, onContactChange }: {
  contact: Contact;
  onBack: () => void;
  onContactChange: (c: Contact) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => remainingWindow(contact.last_message_at));
  const bottomRef = useRef<HTMLDivElement>(null);

  const aiOff = contact.status === "ai_off";
  const expired = remaining <= 0;
  const nearExpiry = remaining > 0 && remaining < 2 * 3600_000;

  useEffect(() => {
    fetch(`/api/messages?contact_id=${contact.id}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  }, [contact.id]);

  useEffect(() => {
    const t = setInterval(() => setRemaining(remainingWindow(contact.last_message_at)), 1000);
    return () => clearInterval(t);
  }, [contact.last_message_at]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  const toggleAi = async () => {
    if (!aiOff && !confirm("AI 자동 응답을 중지합니다. 수동 응대로 전환할까요?")) return;
    if (aiOff === false) {
      // turning OFF
      await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, ai_off: true }),
      });
      onContactChange({ ...contact, status: "ai_off" });
    } else {
      await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, ai_off: false }),
      });
      onContactChange({ ...contact, status: "active" });
    }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    setSendError(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contact.id, text: input.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      setSendError((await res.json()).error ?? "발송 실패");
      return;
    }
    const { message } = await res.json();
    setMessages([...messages, message]);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        <button onClick={onBack} className="md:hidden">←</button>
        <span className="text-sm font-semibold">@{contact.username ?? contact.ig_user_id}</span>
        <ContactStatusBadge status={contact.status} />
        {contact.funnels?.name && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{contact.funnels.name}</span>}
        {contact.escalated && !contact.escalation_ack && <EscalationTag reason={contact.escalation_reason} />}
        <div className="ml-auto flex items-center gap-3">
          <span className={`font-mono text-xs ${expired ? "text-red-400" : nearExpiry ? "text-amber-400" : "text-zinc-400"}`} title="24h 윈도우 남은 시간">
            ⏳ {expired ? "만료" : formatRemaining(remaining)}
          </span>
          <label className="flex items-center gap-1.5 text-xs">
            AI
            <button
              onClick={toggleAi}
              className={`relative h-5 w-9 rounded-full transition ${aiOff ? "bg-amber-600" : "bg-green-600"}`}
              title={aiOff ? "AI OFF (수동 응대 중)" : "AI ON"}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${aiOff ? "left-0.5" : "left-4.5"}`} />
            </button>
          </label>
        </div>
      </div>

      {aiOff && (
        <div className="bg-amber-950 px-3 py-1.5 text-center text-xs text-amber-300">
          현재 수동 응대 중 (AI OFF) — AI 자동 응답이 중지되어 있습니다
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === "out" ? "bg-blue-700" : "bg-zinc-800"}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleString("ko", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {m.funnels?.name && <span>· {m.funnels.name}</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-800 p-3">
        {expired ? (
          <p className="text-center text-xs text-red-400">
            24시간 윈도우가 만료되어 메시지를 보낼 수 없습니다 (Instagram 정책 제한)
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
                placeholder={aiOff ? "수동 응대 메시지 입력…" : "메시지 입력 (수동 발송)"}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <button onClick={send} disabled={sending || !input.trim()} className="rounded-lg bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50">
                {sending ? "…" : "발송"}
              </button>
            </div>
            {sendError && <p className="mt-1 text-xs text-red-400">{sendError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxPageInner />
    </Suspense>
  );
}
