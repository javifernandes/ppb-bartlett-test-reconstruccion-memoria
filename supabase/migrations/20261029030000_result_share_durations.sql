begin;

alter table public.result_shares
  add column reading_seconds integer not null default 0 check (reading_seconds >= 0),
  add column distractor_seconds integer not null default 0 check (distractor_seconds >= 0),
  add column recall_seconds integer not null default 0 check (recall_seconds >= 0),
  add column total_seconds integer not null default 0 check (total_seconds >= 0);

update public.result_shares as share
set
  reading_seconds = greatest(
    0,
    round(extract(epoch from (
      coalesce(
        session.interval_started_at,
        session.recalling_started_at,
        session.submitted_at,
        session.last_activity_at
      ) - session.started_at
    )))::integer
  ),
  distractor_seconds = greatest(
    0,
    round(extract(epoch from (
      coalesce(session.recalling_started_at, session.interval_started_at)
      - coalesce(session.interval_started_at, session.recalling_started_at)
    )))::integer
  ),
  recall_seconds = greatest(
    0,
    round(extract(epoch from (
      coalesce(session.submitted_at, session.last_activity_at)
      - coalesce(session.recalling_started_at, session.submitted_at, session.last_activity_at)
    )))::integer
  ),
  total_seconds = greatest(
    0,
    round(extract(epoch from (
      coalesce(session.submitted_at, session.last_activity_at) - session.started_at
    )))::integer
  )
from public.participant_sessions as session
where session.id = share.session_id;

commit;
