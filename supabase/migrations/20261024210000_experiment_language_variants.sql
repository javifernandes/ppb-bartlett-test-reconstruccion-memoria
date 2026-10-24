begin;

alter table public.experiments
  add column primary_language text not null default 'es'
    check (primary_language in ('es', 'en')),
  add column alternate_language text
    check (alternate_language in ('es', 'en')),
  add column alternate_participant_title text
    check (alternate_participant_title is null or length(btrim(alternate_participant_title)) > 0),
  add column alternate_introduction text
    check (alternate_introduction is null or length(btrim(alternate_introduction)) > 0),
  add column alternate_consent_text text
    check (alternate_consent_text is null or length(btrim(alternate_consent_text)) > 0),
  add column alternate_story text
    check (alternate_story is null or length(btrim(alternate_story)) > 0),
  add column alternate_recall_instructions text
    check (alternate_recall_instructions is null or length(btrim(alternate_recall_instructions)) > 0),
  add constraint experiments_language_variant_consistency check (
    (
      alternate_language is null
      and alternate_participant_title is null
      and alternate_introduction is null
      and alternate_consent_text is null
      and alternate_story is null
      and alternate_recall_instructions is null
    )
    or (
      alternate_language is not null
      and alternate_language <> primary_language
      and alternate_participant_title is not null
      and alternate_introduction is not null
      and alternate_consent_text is not null
      and alternate_story is not null
      and alternate_recall_instructions is not null
    )
  );

alter table public.participant_sessions
  add column content_language text not null default 'es'
    check (content_language in ('es', 'en'));

commit;
