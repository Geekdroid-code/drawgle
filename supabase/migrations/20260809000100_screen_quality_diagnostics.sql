alter table public.screens
  add column if not exists quality_diagnostics jsonb;

comment on column public.screens.quality_diagnostics is
  'Bounded internal static/rendered UI quality telemetry. Never stores source HTML, prompts, or image data.';
