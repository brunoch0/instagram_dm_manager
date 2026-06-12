"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountProvider";

interface Funnel {
  id: string;
  name: string;
  goal: string | null;
  destination_url: string | null;
  trigger_keywords: string[];
  languages: string[];
  system_prompt: string | null;
  active: boolean;
  conversions: number;
}

const LANGS = ["ar", "en", "ko"];

export default function FunnelsPage() {
  const { account } = useAccount();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [days, setDays] = useState(30);
  const [editing, setEditing] = useState<Funnel | "new" | null>(null);

  const load = () => {
    if (!account) return;
    fetch(`/api/funnels?account_id=${account.id}&days=${days}`)
      .then((r) => r.json())
      .then((d) => setFunnels(d.funnels ?? []));
  };

  useEffect(load, [account, days]);

  const toggleActive = async (f: Funnel) => {
    await fetch("/api/funnels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, active: !f.active }),
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold">퍼널</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm">
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
        </select>
        <button onClick={() => setEditing("new")} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
          + 퍼널 추가
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {funnels.map((f) => (
          <div key={f.id} className={`rounded-xl border p-4 ${f.active ? "border-zinc-800 bg-zinc-900" : "border-zinc-900 bg-zinc-950 opacity-60"}`}>
            <div className="mb-2 flex items-center gap-2">
              <button onClick={() => setEditing(f)} className="text-sm font-semibold hover:underline">{f.name}</button>
              <span className="ml-auto text-xs text-zinc-400">{days}일 전환 <b className="text-white">{f.conversions}</b></span>
              <button
                onClick={() => toggleActive(f)}
                className={`relative h-5 w-9 rounded-full transition ${f.active ? "bg-green-600" : "bg-zinc-700"}`}
                title={f.active ? "활성" : "비활성"}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${f.active ? "left-4.5" : "left-0.5"}`} />
              </button>
            </div>
            {f.goal && <p className="mb-1 truncate text-xs text-zinc-400">{f.goal}</p>}
            {f.destination_url && <p className="mb-2 truncate text-xs text-blue-400">{f.destination_url}</p>}
            <div className="flex flex-wrap gap-1">
              {f.trigger_keywords.slice(0, 5).map((k) => (
                <span key={k} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">{k}</span>
              ))}
              {f.trigger_keywords.length > 5 && <span className="text-xs text-zinc-500">+{f.trigger_keywords.length - 5}</span>}
              <span className="ml-auto text-xs text-zinc-500">{f.languages.join("/")}</span>
            </div>
          </div>
        ))}
      </div>

      {editing && account && (
        <FunnelForm
          accountId={account.id}
          funnel={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function FunnelForm({ accountId, funnel, onClose, onSaved }: {
  accountId: string;
  funnel: Funnel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(funnel?.name ?? "");
  const [goal, setGoal] = useState(funnel?.goal ?? "");
  const [url, setUrl] = useState(funnel?.destination_url ?? "");
  const [keywords, setKeywords] = useState<string[]>(funnel?.trigger_keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(funnel?.languages ?? ["en"]);
  const [prompt, setPrompt] = useState(funnel?.system_prompt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !keywords.some((x) => x.toLowerCase() === k.toLowerCase())) {
      setKeywords([...keywords, k]);
    }
    setKeywordInput("");
  };

  const save = async () => {
    if (!name.trim()) { setError("이름을 입력해주세요"); return; }
    if (languages.length === 0) { setError("언어를 1개 이상 선택해주세요"); return; }
    if (url && !/^https?:\/\//.test(url)) { setError("URL은 http(s)://로 시작해야 합니다"); return; }
    setSaving(true);
    setError(null);

    const body = {
      ...(funnel ? { id: funnel.id } : { account_id: accountId }),
      name, goal, destination_url: url || null,
      trigger_keywords: keywords, languages, system_prompt: prompt || null,
    };
    const res = await fetch("/api/funnels", {
      method: funnel ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error ?? "저장 실패"); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-zinc-900 p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-bold">{funnel ? "퍼널 수정" : "퍼널 추가"}</h2>

        <label className="mb-1 block text-xs text-zinc-400">이름 *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />

        <label className="mb-1 block text-xs text-zinc-400">목표</label>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="예: 가이드 발송" />

        <label className="mb-1 block text-xs text-zinc-400">종착 URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="https://…" />

        <label className="mb-1 block text-xs text-zinc-400">트리거 키워드 (Enter로 추가) — 포스트 CTA 키워드로 사용됩니다</label>
        <div className="mb-1 flex gap-2">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
            placeholder="키워드 입력 후 Enter"
          />
          <button onClick={addKeyword} className="rounded-lg border border-zinc-700 px-3 text-sm">추가</button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {keywords.map((k) => (
            <span key={k} className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
              {k}
              <button onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="text-zinc-500 hover:text-white">✕</button>
            </span>
          ))}
        </div>

        <label className="mb-1 block text-xs text-zinc-400">지원 언어 *</label>
        <div className="mb-3 flex gap-3">
          {LANGS.map((l) => (
            <label key={l} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={languages.includes(l)}
                onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))}
              />
              {l}
            </label>
          ))}
        </div>

        <label className="mb-1 block text-xs text-zinc-400">AI 시스템 프롬프트 ({prompt.length}자)</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" placeholder="이 퍼널에서 AI가 따를 추가 지침…" />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm hover:bg-zinc-800">취소</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
