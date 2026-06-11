-- Phase 1 pilot account: @moraevision
-- Token is entered later via Settings tab (encrypted at app layer)

insert into accounts (unit_name, ig_username, active)
values ('MoraeVision', 'moraevision', true)
on conflict (ig_username) do nothing;

-- Initial 4 funnels (PRD §4) — destination URLs/prompts refined in Funnels tab
insert into funnels (account_id, name, goal, destination_url, trigger_keywords, languages, active)
select a.id, f.name, f.goal, f.destination_url, f.trigger_keywords, f.languages, true
from accounts a,
  (values
    ('Guide', 'Send Korea x Islam Bridge Guide', null, array['GUIDE', 'رمضان'], array['en', 'ar']),
    ('Newsletter', 'Beehiiv email signup', null, array['NEWS'], array['en', 'ar']),
    ('Creator', 'UGC creator application', 'https://k-ugc-match.lovable.app', array['CREATOR'], array['en', 'ar']),
    ('Brand B2B', 'Connect Korean brands to Bruno', null, array['KBEAUTY'], array['ko', 'en'])
  ) as f(name, goal, destination_url, trigger_keywords, languages)
where a.ig_username = 'moraevision'
  and not exists (
    select 1 from funnels existing
    where existing.account_id = a.id and existing.name = f.name
  );
