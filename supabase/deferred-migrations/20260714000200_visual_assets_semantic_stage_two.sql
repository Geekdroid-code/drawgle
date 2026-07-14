-- Apply only after the semantic resolver, historical repair, and production smoke suite pass.
drop function if exists public.match_visual_assets(extensions.vector, text, text, boolean, uuid, uuid, float, int);
drop function if exists public.match_visual_assets(extensions.vector, text, text, boolean, float, int);
drop index if exists public.visual_assets_embedding_hnsw_idx;

drop table if exists public.asset_generation_jobs;
drop table if exists public.visual_asset_variants;

alter table public.visual_assets
  drop column if exists embedding,
  drop column if exists dominant_colors,
  drop column if exists safe_area,
  drop column if exists quality_score,
  drop column if exists verification_status,
  drop column if exists verification_score,
  drop column if exists verification_notes;
