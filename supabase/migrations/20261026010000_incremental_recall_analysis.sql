begin;

alter table public.experiments
  add column analysis_run_id text,
  add column analysis_rubrics jsonb,
  add column analysis_prepared_at timestamptz;

create index experiments_analysis_run_idx
  on public.experiments (analysis_run_id);

alter table public.recall_analyses
  add column unit_assessments jsonb not null default '[]'::jsonb;

commit;
