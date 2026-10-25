begin;

alter table public.participant_sessions
  add column country_code text
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column browser_locale text
    check (browser_locale is null or length(btrim(browser_locale)) > 0),
  add column timezone text
    check (timezone is null or length(btrim(timezone)) > 0),
  add column device_type text
    check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')),
  add column browser text
    check (browser is null or length(btrim(browser)) > 0),
  add column operating_system text
    check (operating_system is null or length(btrim(operating_system)) > 0),
  add column screen_width integer
    check (screen_width is null or screen_width between 0 and 20000),
  add column screen_height integer
    check (screen_height is null or screen_height between 0 and 20000);

commit;
