-- Keep checkout and account plan metadata aligned with the verified public product surface.

update public.dodo_pricing_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('features', jsonb_build_array('600 AI credits per month', 'Generate about 30 parent screens per month', 'Blueprint and screen-flow planning', 'Tailwind HTML and Agent Pack exports', 'Screenshot and style-reference workflows'))
where lower(name) = 'starter';

update public.dodo_pricing_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('features', jsonb_build_array('2,400 AI credits per month', 'Generate about 120 parent screens per month', 'Shared design tokens and navigation', 'Selected element and region edits', 'All editor and export features'))
where lower(name) = 'pro';

update public.dodo_pricing_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('features', jsonb_build_array('8,000 AI credits per month', 'Generate about 400 parent screens per month', 'High-volume multi-screen planning', 'Tailwind HTML and Agent Pack exports', 'Shared design tokens and navigation'))
where lower(name) = 'studio';
