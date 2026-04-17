create unique index if not exists generation_runs_project_single_active_idx
on public.generation_runs (project_id)
where status in ('queued', 'planning', 'building');