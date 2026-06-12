-- Escalation tracking on contacts (Console Dashboard/Inbox 기획 반영)
-- reason tags: b2b | complaint | policy | other

alter table contacts add column if not exists escalated boolean not null default false;
alter table contacts add column if not exists escalation_reason text;
alter table contacts add column if not exists escalated_at timestamptz;
alter table contacts add column if not exists escalation_ack boolean not null default false;

create index if not exists contacts_escalated_idx on contacts (account_id, escalated) where escalated = true;
