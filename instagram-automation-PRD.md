# 🤖 Instagram Automation OS — 기획서 (PRD v1)

> **한 줄 요약**: 콘텐츠 스케줄 발행 → 댓글 유도 → AI DM 응대 → funnel 전환까지 한 시스템. ManyChat + Buffer 대체.
> **Phase 1**: @moraevision 파일럿 → 검증 후 **전체 18 unit의 IG 댓글/DM 관리 플랫폼으로 확장**
> **개발**: Claude Code에서 진행. 이 문서가 스펙.
> **작성**: 2026.06.11 (Bruno + Claude 기획 세션)

---

## 1. 확정된 결정사항

| 항목 | 결정 |
|---|---|
| 호스팅 | **Vercel** (사용중) → Next.js 풀스택 |
| 뉴스레터 | **Beehiiv 같이 구축** — funnel 포함, 링크/API는 추후 Settings에 Bruno가 입력 |
| 텔레그램 에스컬레이션 | **최종 단계 (Phase 6)** |
| 영상 제작 | 외부 (Higgsfield/CapCut 등) — 시스템은 업로드만 받음 |
| 첫 적용 계정 | @moraevision (Meta App: aiagent, App ID 27114013451585295) |
| 확장 계획 | **처음부터 멀티 계정 구조로 설계** (accounts 테이블) |

---

## 2. 시스템 아키텍처

```
[영상/이미지 외부 제작]
        ↓ 업로드
┌─────────────────────────────────────┐
│  Instagram Automation OS            │
│  (Next.js on Vercel)                │
│                                     │
│  ① Publisher    — 스케줄 발행        │
│  ② CTA Manager  — 댓글 유도 키워드    │
│  ③ AI Responder — 댓글/DM funnel 응대│
│  ④ Console      — 5탭 관리 화면      │
└─────────────────────────────────────┘
   ↕ IG Graph API / Webhook
   ↕ Claude API (응대 생성)
   ↕ Supabase (DB + Storage)
   → Beehiiv (newsletter funnel)
   → Notion (주간 리포트, Phase 7)
```

### 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | 프론트 + API Routes 한 repo |
| 호스팅 | Vercel | webhook용 공개 HTTPS 기본 제공 |
| 스케줄러 | Vercel Cron Jobs | 매분 posts 테이블 체크 → 발행 |
| DB / Storage | Supabase | 미디어 파일 + 모든 테이블 |
| AI | Anthropic Claude API | funnel 응대 생성 |
| 뉴스레터 | Beehiiv | 같이 구축, API 키 추후 입력 |

⚠️ **Vercel 제약**: serverless 함수 타임아웃 제한 → Reels 컨테이너 처리(수십 초~수 분)는 한 함수에서 polling하지 말고, cron이 `processing` 상태를 재확인하는 2단계 구조로.

---

## 3. 모듈 상세

### ① Publisher (스케줄 발행)

```
미디어 업로드 → Supabase Storage
→ 캡션 작성 + CTA 키워드 선택 (funnel 연결)
→ 발행 시간 예약
→ Vercel Cron (매분): scheduled_at 도래 체크
→ IG Graph API: 컨테이너 생성 → status 확인 → 발행
→ posts.status = published, ig_media_id 저장
```

**IG API 엔드포인트**
```
POST /{ig_user_id}/media                  # 컨테이너 (image_url/video_url + caption)
GET  /{container_id}?fields=status_code   # Reels는 FINISHED 대기
POST /{ig_user_id}/media_publish          # 발행
```

### ② CTA Manager (댓글 유도)

- 포스트마다 **CTA 키워드** 지정 (예: `رمضان`, `KBEAUTY`, `GUIDE`)
- 캡션에 CTA 문구 자동 삽입 (예: "Comment رمضان للحصول على الدليل 🌙")
- 키워드 ↔ funnel 매핑
- 키워드 없는 자유 DM은 AI가 의도 분석해서 funnel 배정

### ③ AI Responder (핵심)

**트리거 2종**
1. 댓글 키워드 감지 → 공개 답글("DM 보냈어요 📩") + DM 시작
2. DM 수신 (자유 입력 포함) → 즉시 AI 응답

**응대 원칙**
1. 사용자가 보낸 메시지에 **반응만** 함 → 24h 윈도우 항상 OPEN 상태에서 응답 = 안전
2. 먼저 follow-up 발송 안 함 (v1)
3. Claude가 의도 분석 → funnel 선택 → 사용자 언어로 응답 → 2-3턴 안에 종착지 유도
4. 거부 의사 → 정중히 종료

**Claude 응답 JSON 스키마**
```json
{
  "selected_funnel": "newsletter",
  "reply": "사용자에게 보낼 텍스트 (300자 이내)",
  "language": "ar | en | ko",
  "should_send_link": true,
  "link": "https://...",
  "escalate": false,
  "conversation_status": "active | converted | ended"
}
```

### ④ Console (관리 화면, 5탭)

| 탭 | 내용 |
|---|---|
| **Dashboard** | 오늘 발행 예정 / 신규 대화 수 / funnel 전환 수 |
| **Schedule** | 캘린더 뷰, 미디어 업로드 + 예약 |
| **Funnels** | funnel 추가/수정 — 목표, 종착 URL, 시스템 프롬프트, 키워드 |
| **Inbox** | 대화 로그, AI 응답 검수, 특정 대화 AI OFF (human takeover) |
| **Settings** | API 키 입력 (§6) |

---

## 4. Funnel Library (초기 4개)

| Funnel | 트리거 의도 | 목표 액션 | 종착지 | 언어 |
|---|---|---|---|---|
| **Guide** | "더 알려줘", info, 키워드 | 가이드 발송 | Korea × Islam Bridge Guide (있음) | EN/AR |
| **Newsletter** | 가벼운 호기심 | 이메일 등록 | Beehiiv — 같이 구축 | EN/AR |
| **Creator** | 본인이 크리에이터 | 신청 | k-ugc-match.lovable.app (있음) | EN/AR |
| **Brand B2B** | 한국 브랜드, 협업 문의 | Bruno 연결 | Calendly/이메일 — 추후 입력 | KO/EN |

추후 추가: **Product**(Gumroad), **Cross-unit**(다른 unit 연결 — 예: 댓글에서 pet 관심 감지 → OnePass Pet 소개)

---

## 5. 데이터 모델 (Supabase)

> 처음부터 **멀티 unit 구조**: accounts 테이블을 두고 모든 테이블이 account_id 참조. Phase 1은 row 1개(@moraevision)로 운영.

```sql
accounts  (id, unit_name, ig_username, ig_user_id,
           access_token_encrypted, token_expires_at, active)
           -- Phase 1: @moraevision 한 개. 확장 시 unit별 row 추가

posts     (id, account_id, media_url, media_type, caption, cta_keyword,
           funnel_id, scheduled_at, status, ig_media_id, published_at)
           -- status: draft | scheduled | processing | published | failed

funnels   (id, account_id, name, goal, destination_url, trigger_keywords[],
           languages[], system_prompt, active)

contacts  (id, account_id, ig_user_id, username, language, first_seen,
           last_message_at,        -- ★ 24h 윈도우 가드 기준값
           current_funnel, status)

messages  (id, contact_id, direction,  -- in | out
           text, funnel_id, created_at)

settings  (key, value_encrypted)       -- 공용 키 (Anthropic, Beehiiv 등)

insights  (post_id, views, reach, likes, follows, pulled_at)  -- Phase 7
```

---

## 6. Settings 메뉴 — API 입력 항목 ⚙️

> 모든 키 마스킹 입력 + 암호화 저장. Bruno가 직접 입력할 항목 — 빈 칸으로 만들어두고 추후 채움.

| 그룹 | 항목 | 어디서 받나 |
|---|---|---|
| **Meta/IG** (계정별) | App ID | developers.facebook.com (aiagent) |
| | App Secret | 앱 설정 → 기본 설정 |
| | IG User ID | 토큰 발급 시 함께 |
| | Access Token (장기) | 단기→장기 교환 (60일, 자동 갱신 로직 포함) |
| | Webhook Verify Token | 임의 설정 (서버와 일치) |
| **Anthropic** | API Key | console.anthropic.com |
| **Supabase** | Project URL + Service Key | 프로젝트 설정 |
| **Beehiiv** | Publication ID + API Key | 구축 후 입력 |
| **Funnel URL** | Guide / K-UGC / B2B 링크 | Funnels 탭에서 관리 |
| **Telegram** *(Phase 6)* | Bot Token + Chat ID | 기존 봇 재사용 |

---

## 7. 안전 규칙 (필수 구현)

1. **24h guard**: `canSendDm(contact)` — 모든 DM 발송 전 체크. `last_message_at` 24시간 초과면 **시도조차 안 함** (시도 자체가 위반 카운트 → 계정 제재 위험)
2. **Rate limit**: 발송 큐 + IG API 에러 시 exponential backoff
3. **AI 응답 제약**: 300자 이내 / 링크는 funnel 등록 URL만 / 가격·계약 확답 금지
4. **에스컬레이션 플래그**: B2B 문의·불만·판단 불가 → `escalate: true` → Inbox 표시 (Phase 6 전까지는 알림 없이 Inbox에서 확인)
5. **Human takeover**: Inbox에서 특정 대화 AI OFF

---

## 8. ⚠️ 현실 체크 — 앱 검수

| 모드 | 가능한 것 |
|---|---|
| **개발 모드 (현재)** | 본인/테스터 계정 발행 ✅, 테스터 계정 간 DM ✅ |
| **Live + 검수 통과** | 모든 사용자의 댓글/DM webhook 수신 + 응답 ✅ |

- 일반 팔로워 DM 응대 = 앱 검수 필수 (`instagram_business_manage_messages`, `manage_comments`). 1-2주 소요
- **전략**: Phase 1-4는 개발 모드에서 본인 계정으로 전부 테스트 → 작동 확인 후 검수 신청 → 통과하면 실사용자 ON
- **ManyChat은 검수 통과 전까지 병행 유지** (운영 공백 방지)

---

## 9. 빌드 로드맵 (Claude Code 작업 순서)

| Phase | 내용 | 완료 기준 | 예상 |
|---|---|---|---|
| **0** | Next.js repo + Supabase 연결 + 테이블 생성 + Vercel 배포 | /api/health 응답 | 0.5일 |
| **1** | Publisher: 업로드 → 예약 → Vercel Cron → IG 자동 발행 | 예약 이미지 1장 자동 발행됨 | 1일 |
| **2** | Webhook 수신 + 키워드 → 고정 DM (ManyChat 복제) | 테스터 댓글 키워드 → DM 도착 | 1일 |
| **3** | Claude AI Responder + funnel routing + 24h guard | 자유 입력 "What do you want"에 funnel 맞춤 응답 | 1-2일 |
| **4** | Console 프론트 5탭 완성 | Settings에 키 입력 → 전체 작동 | 2일 |
| **5** | **Beehiiv 구축** + Newsletter funnel 연결 | DM → 이메일 등록 1건 | 0.5일 |
| **6** | 앱 검수 신청 → Live / **Telegram 에스컬레이션** | 실사용자 DM 응대 + B2B 알림 | +1-2주 대기 |
| **7** | Insights → Notion 주간 동기화 / **멀티 unit 확장** | — | 추후 |

---

## 10. 멀티 unit 확장 비전 (Phase 7+)

> 이 시스템은 MoraèVision 전용이 아니라 **전체 포트폴리오의 IG 댓글/DM 관리 플랫폼**으로 설계됨.

**확장 방식** (이미 구조에 반영됨):
- `accounts` 테이블에 unit별 row 추가만 하면 됨 (IG 테스터 등록 → 토큰 발급 → Settings 입력, 계정당 5분 — IG API 셋업 SOP 참고)
- 하나의 Meta App(aiagent)에 여러 IG 계정 테스터 추가 가능 — 앱 별도 생성 불필요
- funnel은 계정별 독립 (account_id로 분리)
- Console에 계정 스위처 추가

**적용 우선순위**:

| 순서 | Unit | IG | 기대 효과 |
|---|---|---|---|
| 1 | Moraevision | @moraevision | 파일럿 — viral reach 자산화 |
| 2 | Bruno / Creator IP | — | Founder branding, 한국어 funnel |
| 3 | Goldensnow | @goldensnow.ae | API 이미 연결됨 ✓ |
| 4 | OnePass Pet / Dubai Today | TBD | 가이드 funnel 재사용 |

**Cross-unit funnel** (장기): 한 unit의 댓글에서 다른 unit 관심 감지 → 해당 unit으로 연결. 포트폴리오 ecosystem의 데이터 레이어 구현.

---

## 11. Claude Code 시작 프롬프트 (복붙용)

```
Instagram 마케팅 자동화 시스템을 만든다. (멀티 계정 구조, Phase 1은 @moraevision)
스펙: 첨부한 PRD (instagram-automation-PRD.md) 참고.

Phase 0부터 시작:
- Next.js (App Router) 프로젝트 생성, Vercel 배포 전제
- Supabase 연결. 테이블: accounts, posts, funnels, contacts, messages, settings
  (스키마는 PRD §5 그대로 — 모든 테이블 account_id 참조 구조)
- settings와 토큰은 암호화 저장 (키: 환경변수 ENCRYPTION_KEY)
- /api/health 엔드포인트
- 24h guard 함수 canSendDm(contact) 미리 구현 + 유닛테스트

완료되면 Phase 1 (Publisher):
- POST /api/posts — 미디어 업로드(Supabase Storage) + 캡션 + CTA 키워드 + 예약시간
- Vercel Cron (매분): scheduled_at 도래한 posts 체크
  → IG 컨테이너 생성 → (Reels면 status FINISHED 대기, cron 재확인 구조) → media_publish
- 발행 결과 posts 테이블에 기록

주의사항:
- Vercel serverless 타임아웃 고려: 긴 polling 금지, 상태 기반 cron 재확인
- IG API 에러는 backoff + posts.status=failed 기록
- 모든 외부 API 키는 settings/accounts 테이블에서 읽기 (하드코딩 금지)
```

---

## 변경 이력
- 2026.06.11 — v1. 결정: Vercel / Beehiiv 같이 구축 / Telegram 최종단계 / 멀티 unit 확장 구조(accounts) 반영
