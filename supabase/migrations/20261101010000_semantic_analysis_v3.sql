begin;

alter table public.experiments
  add column semantic_analysis_rubrics jsonb,
  add column semantic_analysis_prepared_at timestamptz;

alter table public.analysis_runs
  add column schema_version text not null default 'bartlett-v1'
    check (length(btrim(schema_version)) > 0),
  add column rubric_snapshot jsonb,
  add column completed_at timestamptz,
  add column source_response_count integer
    check (source_response_count is null or source_response_count >= 0);

alter table public.recall_analyses
  add column semantic_assessment jsonb,
  add column semantic_summary jsonb;

update public.analysis_runs as run
set
  rubric_snapshot = experiment.analysis_rubrics,
  completed_at = case
    when run.status in ('completed', 'completed_with_errors') then coalesce(
      (
        select max(analysis.created_at)
        from public.recall_analyses as analysis
        where analysis.run_id = run.id
      ),
      run.created_at
    )
    else null
  end,
  source_response_count = (
    select count(*)::integer
    from public.recall_analyses as analysis
    where analysis.run_id = run.id
  )
from public.experiments as experiment
where experiment.id = run.experiment_id;

create index analysis_runs_schema_version_idx
  on public.analysis_runs (schema_version);

commit;
