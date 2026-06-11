-- Instagram Automation OS — initial schema (PRD §5)
-- Multi-account structure from day 1: every table references accounts(id)

create extension if not exists "pgcrypto";

-- ── accounts ──────────────────────────────────────────────
-- Phase 1: single row (@moraevision). New units = new rows.
create table accounts (
  id uuid primary key default gen_random_uuid(),
  unit_name text not null,
  ig_username text not null unique,
  ig_user_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── funnels ───────────────────────────────────────────────
create table funnels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  goal text,
  destination_url text,
  trigger_keywords text[] not null default '{}',
  languages text[] not null default '{}',
  system_prompt text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── posts ─────────────────────────────────────────────────
create table posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'reels', 'carousel')),
  caption text,
  cta_keyword text,
  funnel_id uuid references funnels(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'processing', 'published', 'failed')),
  ig_container_id text,
  ig_media_id text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index posts_due_idx on posts (scheduled_at) where status in ('scheduled', 'processing');

-- ── contacts ──────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  ig_user_id text not null,
  username text,
  language text,
  first_seen timestamptz not null default now(),
  last_message_at timestamptz,  -- 24h window guard reference value
  current_funnel uuid references funnels(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'converted', 'ended', 'ai_off')),
  unique (account_id, ig_user_id)
);

-- ── messages ──────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  text text,
  funnel_id uuid references funnels(id) on delete set null,
  created_at timestamptz not null default now()
);

create index messages_contact_idx on messages (contact_id, created_at);

-- ── settings ──────────────────────────────────────────────
-- Shared keys (Anthropic, Beehiiv, etc.) — values encrypted at app layer
create table settings (
  key text primary key,
  value_encrypted text,
  updated_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────
-- Server-only access via service role key; block anon/authenticated by default
alter table accounts enable row level security;
alter table funnels enable row level security;
alter table posts enable row level security;
alter table contacts enable row level security;
alter table messages enable row level security;
alter table settings enable row level security;
