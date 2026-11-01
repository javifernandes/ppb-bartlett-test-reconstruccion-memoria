begin;

alter table public.experiments
  add column live_analysis_run_id text references public.analysis_runs(id),
  add column reporting_analysis_run_id text references public.analysis_runs(id);

update public.experiments
set
  live_analysis_run_id = analysis_run_id,
  reporting_analysis_run_id = analysis_run_id;

create index experiments_live_analysis_run_id_idx
  on public.experiments (live_analysis_run_id);

create index experiments_reporting_analysis_run_id_idx
  on public.experiments (reporting_analysis_run_id);

commit;
