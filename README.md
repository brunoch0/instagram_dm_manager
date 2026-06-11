# Instagram Automation OS

콘텐츠 스케줄 발행 → 댓글 유도 → AI DM 응대 → funnel 전환까지 한 시스템 (ManyChat + Buffer 대체).
스펙: [instagram-automation-PRD.md](./instagram-automation-PRD.md)

## Stack

- Next.js (App Router) on Vercel
- Supabase (DB + Storage) — project `lpfeeuzsbyekestlhiro`
- Anthropic Claude API (AI Responder)
- IG Graph API / Webhooks

## Setup

```bash
npm install
cp .env.example .env.local   # 값 채우기 (Supabase service key, ENCRYPTION_KEY 등)
npm run dev                  # http://localhost:3000/api/health
npm test                     # unit tests (canSendDm, crypto)
```

`ENCRYPTION_KEY` 생성: `openssl rand -base64 32`

## Database

마이그레이션: `supabase/migrations/` 순서대로 Supabase SQL Editor에서 실행

1. `0001_initial_schema.sql` — accounts, funnels, posts, contacts, messages, settings (+ RLS)
2. `0002_seed_moraevision.sql` — @moraevision 계정 + 초기 funnel 4개

## Build Roadmap

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | Repo + Supabase 스키마 + /api/health + canSendDm guard | ✅ |
| 1 | Publisher: 업로드 → 예약 → Cron → IG 자동 발행 | — |
| 2 | Webhook 수신 + 키워드 → 고정 DM | — |
| 3 | Claude AI Responder + funnel routing | — |
| 4 | Console 5탭 (Dashboard/Schedule/Funnels/Inbox/Settings) | — |
| 5 | Beehiiv + Newsletter funnel | — |
| 6 | 앱 검수 → Live + Telegram 에스컬레이션 | — |
| 7 | Insights → Notion / 멀티 unit 확장 | — |

## Safety Rules (필수)

- **24h guard**: 모든 DM 발송은 `canSendDm()` 통과 필수 — 윈도우 밖이면 시도 자체 금지
- AI 응답 300자 이내, 링크는 funnel 등록 URL만
- 모든 API 키/토큰은 AES-256-GCM 암호화 저장 (`lib/crypto.ts`)
