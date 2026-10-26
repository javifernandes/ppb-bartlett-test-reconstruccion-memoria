begin;

-- Publishing reserves the analysis run id before AnalysisRun.start creates it.
-- The application validates that relationship once the run is started, so an
-- immediate database foreign key would reject the intended two-step workflow.
alter table public.experiments
  drop constraint if exists experiments_analysis_run_fk;

commit;
