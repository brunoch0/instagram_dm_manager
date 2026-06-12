"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountProvider";

interface SettingRow {
  key: string;
  set: boolean;
  masked: string | null;
}

const KEY_GROUPS: Array<{ title: string; keys: Array<{ key: string; label: string }> }> = [
  {
    title: "Meta / Instagram (공용 앱)",
    keys: [
      { key: "meta_app_id", label: "App ID" },
      { key: "meta_app_secret", label: "App Secret" },
      { key: "ig_webhook_verify_token", label: "Webhook Verify Token" },
    ],
  },
  {
    title: "Anthropic",
    keys: [{ key: "anthropic_api_key", label: "API Key" }],
  },
  {
    title: "Beehiiv (Phase 5)",
    keys: [
      { key: "beehiiv_publication_id", label: "Publication ID" },
      { key: "beehiiv_api_key", label: "API Key" },
    ],
  },
  {
    title: "Telegram (Phase 6)",
    keys: [
      { key: "telegram_bot_token", label: "Bot Token" },
      { key: "telegram_chat_id", label: "Chat ID" },
    ],
  },
];

export default function SettingsPage() {
  const { accounts, account, reload } = useAccount();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // per-account token form
  const [igUserId, setIgUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [tokenExpiry, setTokenExpiry] = useState("");

  // new account form
  const [newUnit, setNewUnit] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const loadSettings = () => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings ?? []));
  };

  useEffect(loadSettings, []);
  useEffect(() => {
    setIgUserId(account?.ig_user_id ?? "");
    setTokenExpiry(account?.token_expires_at?.slice(0, 10) ?? "");
    setAccessToken("");
  }, [account]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const saveSharedKeys = async () => {
    const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v));
    if (Object.keys(filled).length === 0) return;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: filled }),
    });
    if (res.ok) {
      setValues({});
      loadSettings();
      notify("저장됨 (암호화 완료)");
    } else {
      notify("저장 실패");
    }
  };

  const saveAccountToken = async () => {
    if (!account) return;
    const body: Record<string, unknown> = { id: account.id };
    if (igUserId) body.ig_user_id = igUserId;
    if (accessToken) body.access_token = accessToken;
    if (tokenExpiry) body.token_expires_at = new Date(tokenExpiry).toISOString();
    const res = await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setAccessToken("");
      reload();
      notify("계정 정보 저장됨");
    } else {
      notify("저장 실패");
    }
  };

  const addAccount = async () => {
    if (!newUnit || !newUsername) return;
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit_name: newUnit, ig_username: newUsername }),
    });
    if (res.ok) {
      setNewUnit("");
      setNewUsername("");
      reload();
      notify("계정 추가됨");
    } else {
      notify("추가 실패");
    }
  };

  const expiryDays = account?.token_expires_at
    ? Math.floor((new Date(account.token_expires_at).getTime() - Date.now()) / 86400_000)
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-bold">설정</h1>
      <p className="text-xs text-zinc-500">🔒 모든 키는 AES-256-GCM으로 암호화되어 저장됩니다</p>

      {/* Per-account: IG token */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 text-sm font-semibold">계정 토큰 — {account ? `${account.unit_name} (@${account.ig_username})` : "계정 없음"}</h2>
        {expiryDays !== null && (
          <p className={`mb-3 text-xs ${expiryDays <= 1 ? "text-red-400" : expiryDays <= 7 ? "text-amber-400" : "text-zinc-400"}`}>
            토큰 만료까지 {expiryDays}일 {expiryDays <= 7 && "— 갱신이 필요합니다"}
          </p>
        )}
        <label className="mb-1 block text-xs text-zinc-400">IG User ID</label>
        <input value={igUserId} onChange={(e) => setIgUserId(e.target.value)} className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />
        <label className="mb-1 block text-xs text-zinc-400">
          Access Token (장기) {account?.has_token && <span className="text-green-400">— 저장됨 ✓</span>}
        </label>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={account?.has_token ? "변경하려면 새 토큰 입력" : "IGQVJW…"}
          className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
        />
        <label className="mb-1 block text-xs text-zinc-400">토큰 만료일</label>
        <input type="date" value={tokenExpiry} onChange={(e) => setTokenExpiry(e.target.value)} className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />
        <button onClick={saveAccountToken} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">저장</button>
      </section>

      {/* Shared API keys */}
      {KEY_GROUPS.map((group) => (
        <section key={group.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold">{group.title}</h2>
          {group.keys.map(({ key, label }) => {
            const row = settings.find((s) => s.key === key);
            return (
              <div key={key} className="mb-3">
                <label className="mb-1 block text-xs text-zinc-400">
                  {label} {row?.set && <span className="text-green-400">— 저장됨 ({row.masked})</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type={show[key] ? "text" : "password"}
                    value={values[key] ?? ""}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    placeholder={row?.set ? "변경하려면 새 값 입력" : "입력…"}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
                  />
                  <button onClick={() => setShow({ ...show, [key]: !show[key] })} className="rounded-lg border border-zinc-700 px-3 text-sm" title="보기/숨기기">
                    {show[key] ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <button onClick={saveSharedKeys} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
        공용 키 저장
      </button>

      {/* Add account */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 text-sm font-semibold">계정 추가 (멀티 unit 확장)</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unit 이름 (예: Goldensnow)" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />
          <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="@username" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />
          <button onClick={addAccount} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">추가</button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">현재 {accounts.length}개 계정 등록됨</p>
      </section>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
