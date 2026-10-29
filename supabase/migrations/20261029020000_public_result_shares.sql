begin;

create table public.result_shares (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  session_id text not null references public.participant_sessions(id) on delete cascade,
  content_language text not null check (content_language in ('es', 'en')),
  story text not null check (length(btrim(story)) > 0),
  recall_text text not null check (length(btrim(recall_text)) > 0),
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null
);

create index result_shares_experiment_idx
  on public.result_shares (experiment_id);
create index result_shares_session_idx
  on public.result_shares (session_id);
create unique index result_shares_one_active_per_session
  on public.result_shares (session_id)
  where status = 'active';

alter table public.result_shares enable row level security;
alter table public.result_shares force row level security;
revoke all on table public.result_shares from anon, authenticated;
grant select, insert, update, delete on table public.result_shares to service_role;

commit;
