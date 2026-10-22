begin;

create table public.experiments (
  id text primary key,
  title text not null check (length(btrim(title)) > 0),
  participant_title text not null check (length(btrim(participant_title)) > 0),
  introduction text not null check (length(btrim(introduction)) > 0),
  consent_text text not null check (length(btrim(consent_text)) > 0),
  story text not null check (length(btrim(story)) > 0),
  recall_instructions text not null check (length(btrim(recall_instructions)) > 0),
  interval_seconds integer not null check (interval_seconds between 0 and 3600),
  distractor_enabled boolean not null,
  status text not null check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null,
  published_at timestamptz,
  public_token text unique check (public_token is null or length(btrim(public_token)) > 0),
  constraint experiments_publication_consistency check (
    (status = 'draft' and published_at is null and public_token is null)
    or (status in ('published', 'closed') and published_at is not null and public_token is not null)
  )
);

create table public.participant_sessions (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  status text not null check (status in ('reading', 'interval', 'recalling', 'submitted')),
  started_at timestamptz not null,
  interval_started_at timestamptz,
  recalling_started_at timestamptz,
  last_activity_at timestamptz not null,
  recall_text text check (recall_text is null or length(btrim(recall_text)) > 0),
  submitted_at timestamptz
);

create index participant_sessions_experiment_idx
  on public.participant_sessions (experiment_id);
create index participant_sessions_status_idx
  on public.participant_sessions (status);

create table public.analysis_runs (
  id text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  status text not null check (
    status in ('running', 'completed', 'completed_with_errors')
  ),
  analyzer_version text not null check (length(btrim(analyzer_version)) > 0),
  created_at timestamptz not null
);

create index analysis_runs_experiment_idx
  on public.analysis_runs (experiment_id);

create table public.recall_analyses (
  id text primary key,
  run_id text not null references public.analysis_runs(id) on delete cascade,
  session_id text not null references public.participant_sessions(id) on delete cascade,
  experiment_id text not null references public.experiments(id) on delete cascade,
  status text not null check (status = 'completed'),
  rubric_version text not null check (length(btrim(rubric_version)) > 0),
  analyzer_provider text not null check (length(btrim(analyzer_provider)) > 0),
  analyzer_model text not null check (length(btrim(analyzer_model)) > 0),
  prompt_version text not null check (length(btrim(prompt_version)) > 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  retained_units_count integer not null check (retained_units_count >= 0),
  omitted_units_count integer not null check (omitted_units_count >= 0),
  intrusion_count integer not null check (intrusion_count >= 0),
  phenomena jsonb not null,
  created_at timestamptz not null,
  unique (run_id, session_id)
);

create index recall_analyses_experiment_idx
  on public.recall_analyses (experiment_id);
create index recall_analyses_session_idx
  on public.recall_analyses (session_id);

alter table public.experiments enable row level security;
alter table public.participant_sessions enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.recall_analyses enable row level security;

alter table public.experiments force row level security;
alter table public.participant_sessions force row level security;
alter table public.analysis_runs force row level security;
alter table public.recall_analyses force row level security;

revoke all on table public.experiments from anon, authenticated;
revoke all on table public.participant_sessions from anon, authenticated;
revoke all on table public.analysis_runs from anon, authenticated;
revoke all on table public.recall_analyses from anon, authenticated;

grant select, insert, update, delete on table public.experiments to service_role;
grant select, insert, update, delete on table public.participant_sessions to service_role;
grant select, insert, update, delete on table public.analysis_runs to service_role;
grant select, insert, update, delete on table public.recall_analyses to service_role;

commit;
