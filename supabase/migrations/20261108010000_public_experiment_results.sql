begin;

create table public.experiment_result_shares (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  run_id text not null references public.analysis_runs(id) on delete cascade,
  status text not null check (status in ('active', 'disabled')),
  created_at timestamptz not null
);

create index experiment_result_shares_experiment_idx
  on public.experiment_result_shares (experiment_id);

create unique index experiment_result_shares_one_active_per_experiment
  on public.experiment_result_shares (experiment_id)
  where status = 'active';

alter table public.experiment_result_shares enable row level security;
alter table public.experiment_result_shares force row level security;
revoke all on table public.experiment_result_shares from anon, authenticated;
grant select, insert, update, delete on table public.experiment_result_shares to service_role;

commit;
