alter table public.visual_assets
  add column if not exists semantic_category text not null default 'other',
  add column if not exists provider_asset_id text null,
  add column if not exists source_url text null,
  add column if not exists attribution text null,
  add column if not exists status text not null default 'active';

alter table public.visual_assets
  drop constraint if exists visual_assets_semantic_category_check;
alter table public.visual_assets
  add constraint visual_assets_semantic_category_check check (
    semantic_category in (
      'person', 'animal', 'food', 'fashion', 'electronics', 'vehicle', 'fitness',
      'beauty', 'home', 'place', 'nature', 'map', 'logo', 'generic_product', 'other'
    )
  );

alter table public.visual_assets
  drop constraint if exists visual_assets_status_check;
alter table public.visual_assets
  add constraint visual_assets_status_check check (status in ('active', 'disabled'));

update public.visual_assets
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacyOriginal', jsonb_build_object(
      'r2Key', r2_key,
      'publicUrl', public_url,
      'width', width,
      'height', height,
      'mimeType', mime_type,
      'byteSize', byte_size
    )
  ),
  status = case when verification_status in ('verified', 'skipped') then 'active' else 'disabled' end,
  source_url = coalesce(source_url, metadata ->> 'originalRemoteUrl')
where not (coalesce(metadata, '{}'::jsonb) ? 'legacyOriginal');

update public.visual_assets as asset
set
  r2_key = variant.r2_key,
  public_url = variant.public_url,
  width = variant.width,
  height = variant.height,
  mime_type = variant.mime_type,
  byte_size = variant.byte_size
from public.visual_asset_variants as variant
where variant.asset_id = asset.id
  and variant.variant = 'display_1024';

with canonical(id, subject, role, category, tags, reuse_key) as (
  values
    ('b8041495-1552-4079-9c20-80bd656e240f'::uuid, 'Berry', 'product_cutout', 'food', array['berry','fruit','produce'], 'product-cutout-food-berry'),
    ('3cb3650d-1d26-4aba-9d6e-9e9da26f92a7'::uuid, 'Black car', 'product_cutout', 'vehicle', array['black','car','vehicle'], 'product-cutout-vehicle-car'),
    ('fde9349c-c273-4410-a88c-e8515258cdf8'::uuid, 'Black earbuds', 'product_cutout', 'electronics', array['audio','black','earbuds'], 'product-cutout-electronics-earbuds-black'),
    ('64f6442b-0b5a-4bf7-9cac-b45331db157a'::uuid, 'Red headphones', 'product_cutout', 'electronics', array['audio','headphones','red'], 'product-cutout-electronics-headphones-red'),
    ('b5b0f33c-c8fc-4175-8831-da20be978bb2'::uuid, 'Burger', 'product_cutout', 'food', array['burger','fast_food'], 'product-cutout-food-burger'),
    ('005ceadb-8071-46ea-b963-9344a85ec918'::uuid, 'Cake', 'product_cutout', 'food', array['bakery','cake','dessert'], 'product-cutout-food-cake'),
    ('8c223734-47fc-4051-82c2-68efbf98d46d'::uuid, 'Cauliflower', 'product_cutout', 'food', array['cauliflower','produce','vegetable'], 'product-cutout-food-cauliflower'),
    ('b19c6b10-06a0-4d8a-b417-96c2e30f783a'::uuid, 'Cookie', 'product_cutout', 'food', array['bakery','cookie','dessert'], 'product-cutout-food-cookie'),
    ('60ae5021-d010-4997-839a-7198a052762d'::uuid, 'Cookies', 'product_cutout', 'food', array['bakery','cookie','cookies','dessert'], 'product-cutout-food-cookies'),
    ('701e9faf-afda-444d-8c05-f9dac493d710'::uuid, 'French fries', 'product_cutout', 'food', array['fast_food','fries'], 'product-cutout-food-fries'),
    ('380b72a2-c301-486e-997e-017dda15407d'::uuid, 'Ice cream', 'product_cutout', 'food', array['dessert','ice_cream'], 'product-cutout-food-ice-cream'),
    ('555e4f8a-4c5c-47c1-aa9c-81b946e36e31'::uuid, 'JBL headphones', 'product_cutout', 'electronics', array['audio','headphones','jbl'], 'product-cutout-electronics-jbl-headphones'),
    ('e0d4673d-f87b-40b8-ba59-4a1d4601e944'::uuid, 'Man wearing a jacket', 'product_cutout', 'fashion', array['clothing','jacket','man','model'], 'product-cutout-fashion-jacket-man'),
    ('04ac4be7-dfaa-4d56-8fef-67df0e9a9199'::uuid, 'Mango', 'product_cutout', 'food', array['fruit','mango','produce'], 'product-cutout-food-mango'),
    ('52295820-7705-4cae-9874-f234980861ac'::uuid, 'Papaya', 'product_cutout', 'food', array['fruit','papaya','produce'], 'product-cutout-food-papaya'),
    ('c1118c98-db19-4bf2-85c7-d4ec500400ac'::uuid, 'Pastry', 'product_cutout', 'food', array['bakery','dessert','pastry'], 'product-cutout-food-pastry'),
    ('54d5b9c8-c7f5-4b9d-a5cf-6b0fa97109e5'::uuid, 'Pineapple', 'product_cutout', 'food', array['fruit','pineapple','produce'], 'product-cutout-food-pineapple'),
    ('d20f574c-dc31-40c5-b7bc-34c50e95b875'::uuid, 'Blonde woman portrait', 'avatar', 'person', array['avatar','portrait','woman'], 'avatar-person-blonde-woman'),
    ('5d5c1d0d-509d-47d8-90bd-2eab2fa3ddbf'::uuid, 'Taco', 'product_cutout', 'food', array['fast_food','taco'], 'product-cutout-food-taco'),
    ('337882cb-6d9b-4caa-b0b2-f914032fb62c'::uuid, 'Taxi', 'hero_cutout', 'vehicle', array['taxi','vehicle'], 'hero-cutout-vehicle-taxi'),
    ('c406f0f3-19c9-418b-a806-e5654beac13b'::uuid, 'White earbuds', 'product_cutout', 'electronics', array['audio','earbuds','white'], 'product-cutout-electronics-earbuds-white'),
    ('1496b44e-9fea-45df-89ca-a45cd8bd6e40'::uuid, 'Woman model', 'hero_cutout', 'person', array['hero','model','person','woman'], 'hero-cutout-person-woman-model')
)
update public.visual_assets as asset
set
  subject = canonical.subject,
  role = canonical.role,
  semantic_category = canonical.category,
  tags = canonical.tags,
  reuse_key = canonical.reuse_key,
  status = 'active',
  updated_at = now()
from canonical
where asset.id = canonical.id;

create index if not exists visual_assets_semantic_lookup_idx
  on public.visual_assets(status, source, role, semantic_category, asset_type, has_alpha);

create index if not exists visual_assets_reuse_lookup_idx
  on public.visual_assets(status, reuse_key, semantic_category);

drop index if exists public.visual_assets_provider_asset_unique_idx;
create unique index visual_assets_provider_asset_unique_idx
  on public.visual_assets(provider, provider_asset_id, reuse_key)
  where provider_asset_id is not null;
