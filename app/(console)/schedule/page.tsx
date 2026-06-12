"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/components/AccountProvider";
import { PostStatusBadge } from "@/components/Badge";

interface Post {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  cta_keyword: string | null;
  funnel_id: string | null;
  scheduled_at: string | null;
  status: string;
  error_message: string | null;
  published_at: string | null;
}

interface Funnel {
  id: string;
  name: string;
  trigger_keywords: string[];
}

function SchedulePageInner() {
  const { account } = useAccount();
  const params = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Post | null>(null);

  const load = () => {
    if (!account) return;
    fetch(`/api/posts?account_id=${account.id}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []));
    fetch(`/api/funnels?account_id=${account.id}`)
      .then((r) => r.json())
      .then((d) => setFunnels(d.funnels ?? []));
  };

  useEffect(load, [account]);

  // deep-link from dashboard (?post=id)
  useEffect(() => {
    const postId = params.get("post");
    if (postId && posts.length) {
      const p = posts.find((x) => x.id === postId);
      if (p) setDetail(p);
    }
  }, [params, posts]);

  const calendarCells = useMemo(() => {
    const first = new Date(month);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; posts: Post[] }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, posts: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const dayPosts = posts.filter((p) => {
        if (!p.scheduled_at) return false;
        const pd = new Date(p.scheduled_at);
        return pd.getFullYear() === date.getFullYear() && pd.getMonth() === date.getMonth() && pd.getDate() === d;
      });
      cells.push({ date, posts: dayPosts });
    }
    return cells;
  }, [month, posts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold">스케줄</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setView(view === "list" ? "calendar" : "list")}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            {view === "list" ? "🗓️ 캘린더" : "📋 리스트"}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            + 포스트 만들기
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded px-2 py-1 hover:bg-zinc-900">←</button>
            <span className="text-sm font-medium">{month.getFullYear()}년 {month.getMonth() + 1}월</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded px-2 py-1 hover:bg-zinc-900">→</button>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 text-xs">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="bg-zinc-900 p-2 text-center text-zinc-400">{d}</div>
            ))}
            {calendarCells.map((cell, i) => (
              <div key={i} className="min-h-20 bg-zinc-950 p-1">
                {cell.date && (
                  <>
                    <div className="mb-1 text-zinc-500">{cell.date.getDate()}</div>
                    {cell.posts.slice(0, 3).map((p) => (
                      <button key={p.id} onClick={() => setDetail(p)} className="mb-0.5 block w-full truncate rounded bg-zinc-800 px-1 py-0.5 text-left hover:bg-zinc-700">
                        <PostStatusBadge status={p.status} />
                      </button>
                    ))}
                    {cell.posts.length > 3 && <div className="text-zinc-500">+{cell.posts.length - 3}</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.length === 0 && (
            <li className="rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-500">
              아직 예약된 포스트가 없습니다
            </li>
          )}
          {posts.map((p) => (
            <li key={p.id}>
              <button onClick={() => setDetail(p)} className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left hover:border-zinc-600">
                {p.media_url && p.media_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-lg">🎬</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.caption || "(캡션 없음)"}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <PostStatusBadge status={p.status} />
                    {p.cta_keyword && <span className="rounded bg-zinc-800 px-1.5">#{p.cta_keyword}</span>}
                    {p.scheduled_at && <span>{new Date(p.scheduled_at).toLocaleString("ko")}</span>}
                  </div>
                  {p.status === "failed" && p.error_message && (
                    <div className="mt-1 truncate text-xs text-red-400">{p.error_message}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && account && (
        <CreatePostModal
          accountId={account.id}
          funnels={funnels}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {detail && (
        <PostDetailPanel
          post={detail}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

function CreatePostModal({ accountId, funnels, onClose, onCreated }: {
  accountId: string;
  funnels: Funnel[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [ctaKeyword, setCtaKeyword] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFunnel = funnels.find((f) => f.id === funnelId);

  const submit = async (asDraft: boolean) => {
    if (!file) { setError("미디어 파일을 업로드해주세요"); return; }
    if (!asDraft && !scheduledAt) { setError("예약 시간을 선택해주세요"); return; }
    setSaving(true);
    setError(null);

    const form = new FormData();
    form.set("account_id", accountId);
    form.set("file", file);
    form.set("media_type", mediaType);
    form.set("caption", caption);
    if (ctaKeyword) form.set("cta_keyword", ctaKeyword);
    if (funnelId) form.set("funnel_id", funnelId);
    if (!asDraft && scheduledAt) form.set("scheduled_at", new Date(scheduledAt).toISOString());

    const res = await fetch("/api/posts", { method: "POST", body: form });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "저장 실패"); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-zinc-900 p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-bold">포스트 만들기</h2>

        <label className="mb-1 block text-xs text-zinc-400">1. 미디어</label>
        <div className="mb-1 flex gap-2">
          {["image", "reels"].map((t) => (
            <button key={t} onClick={() => setMediaType(t)} className={`rounded-lg px-3 py-1 text-sm ${mediaType === t ? "bg-white text-zinc-900" : "bg-zinc-800"}`}>
              {t === "image" ? "이미지" : "릴스"}
            </button>
          ))}
        </div>
        <input
          type="file"
          accept={mediaType === "image" ? "image/*" : "video/*"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-zinc-200"
        />

        <label className="mb-1 block text-xs text-zinc-400">2. 캡션 ({caption.length}자)</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
          placeholder="캡션 입력…"
        />

        <label className="mb-1 block text-xs text-zinc-400">3. 퍼널 연결 (CTA 키워드)</label>
        <select value={funnelId} onChange={(e) => {
          setFunnelId(e.target.value);
          const f = funnels.find((x) => x.id === e.target.value);
          setCtaKeyword(f?.trigger_keywords[0] ?? "");
        }} className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm">
          <option value="">퍼널 선택 안 함</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {selectedFunnel && (
          <div className="mb-4 flex flex-wrap gap-1">
            {selectedFunnel.trigger_keywords.map((k) => (
              <button key={k} onClick={() => setCtaKeyword(k)} className={`rounded px-2 py-0.5 text-xs ${ctaKeyword === k ? "bg-white text-zinc-900" : "bg-zinc-800"}`}>
                {k}
              </button>
            ))}
          </div>
        )}

        <label className="mb-1 block text-xs text-zinc-400">4. 예약 시간</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={() => submit(true)} disabled={saving} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">
            초안 저장
          </button>
          <button onClick={() => submit(false)} disabled={saving} className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
            {saving ? "저장 중…" : "예약"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetailPanel({ post, onClose, onChanged }: { post: Post; onClose: () => void; onChanged: () => void }) {
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const reschedule = async () => {
    if (!rescheduleAt) return;
    setBusy(true);
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_at: new Date(rescheduleAt).toISOString() }),
    });
    setBusy(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm("이 포스트를 삭제할까요?")) return;
    setBusy(true);
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-zinc-900 p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <PostStatusBadge status={post.status} />
          {post.scheduled_at && <span className="text-xs text-zinc-500">{new Date(post.scheduled_at).toLocaleString("ko")}</span>}
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white">✕</button>
        </div>

        {post.media_url && post.media_type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.media_url} alt="" className="mb-3 max-h-60 w-full rounded-lg object-contain" />
        )}

        <p className="mb-3 whitespace-pre-wrap text-sm">{post.caption || "(캡션 없음)"}</p>
        {post.cta_keyword && <p className="mb-3 text-xs text-zinc-400">CTA 키워드: <span className="rounded bg-zinc-800 px-1.5 py-0.5">{post.cta_keyword}</span></p>}

        {post.status === "failed" && (
          <div className="mb-3 rounded-lg bg-red-950 p-3">
            <div className="mb-1 text-xs font-medium text-red-300">에러 메시지</div>
            <pre className="whitespace-pre-wrap break-all text-xs text-red-200">{post.error_message}</pre>
            <button onClick={() => navigator.clipboard.writeText(post.error_message ?? "")} className="mt-2 rounded bg-red-900 px-2 py-1 text-xs">복사</button>
          </div>
        )}

        {(post.status === "failed" || post.status === "draft" || post.status === "scheduled") && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-zinc-400">{post.status === "failed" ? "재예약" : "예약 시간 변경"}</label>
            <div className="flex gap-2">
              <input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm" />
              <button onClick={reschedule} disabled={busy || !rescheduleAt} className="rounded-lg bg-white px-3 text-sm font-medium text-zinc-900 disabled:opacity-50">
                {post.status === "failed" ? "재예약" : "변경"}
              </button>
            </div>
          </div>
        )}

        {post.status !== "published" && post.status !== "processing" && (
          <button onClick={remove} disabled={busy} className="text-xs text-red-400 hover:text-red-300">포스트 삭제</button>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense>
      <SchedulePageInner />
    </Suspense>
  );
}
