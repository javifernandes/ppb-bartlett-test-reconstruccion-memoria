begin;

create table public.share_channels (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null
);

create index share_channels_experiment_idx
  on public.share_channels (experiment_id);
create unique index share_channels_experiment_name_unique
  on public.share_channels (experiment_id, lower(name));

alter table public.participant_sessions
  add column share_channel_id text
    references public.share_channels(id) on delete set null;

create index participant_sessions_share_channel_idx
  on public.participant_sessions (share_channel_id);

alter table public.share_channels enable row level security;
alter table public.share_channels force row level security;
revoke all on table public.share_channels from anon, authenticated;
grant select, insert, update, delete on table public.share_channels to service_role;

commit;
