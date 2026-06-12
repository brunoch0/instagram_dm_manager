const POST_STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-200",
  scheduled: "bg-blue-900 text-blue-200",
  processing: "bg-purple-900 text-purple-200",
  published: "bg-green-900 text-green-200",
  failed: "bg-red-900 text-red-200",
};

const CONTACT_STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-900 text-blue-200",
  converted: "bg-green-900 text-green-200",
  ended: "bg-zinc-700 text-zinc-300",
  ai_off: "bg-amber-900 text-amber-200",
};

const ESCALATION_LABELS: Record<string, string> = {
  b2b: "B2B 문의",
  complaint: "불만",
  policy: "정책",
  other: "기타",
};

export function PostStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${POST_STATUS_STYLES[status] ?? POST_STATUS_STYLES.draft}`}>
      {status === "failed" && "⚠️"}
      {status}
    </span>
  );
}

export function ContactStatusBadge({ status }: { status: string }) {
  const label = status === "ai_off" ? "AI OFF" : status;
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${CONTACT_STATUS_STYLES[status] ?? CONTACT_STATUS_STYLES.ended}`}>
      {label}
    </span>
  );
}

export function EscalationTag({ reason }: { reason: string | null }) {
  return (
    <span className="inline-flex rounded bg-red-900 px-1.5 py-0.5 text-xs font-medium text-red-200">
      ⚠️ {ESCALATION_LABELS[reason ?? "other"] ?? "기타"}
    </span>
  );
}
