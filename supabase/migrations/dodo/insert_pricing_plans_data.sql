-- Clear existing pricing plans before inserting new ones
TRUNCATE public.dodo_pricing_plans CASCADE;

-- Insert the three payment plans for dodopayments integration
INSERT INTO public.dodo_pricing_plans (
  name,
  description,
  price,
  credits,
  currency,
  dodo_product_id,
  is_active,
  metadata
) VALUES 

(
  'Lite',
  'Casual designers, indie hackers, validating concepts.',
  9.99,
  600,
  'USD',
  'pdt_lite_placeholder', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["600 AI credits per month", "Build ~20 full screens/mo", "Research-backed brief planner (Free)", "Figma integration & export", "Tailwind CSS components"]}'
),

(
  'Starter',
  'Startups, active developers, active builders.',
  17.49,
  1500,
  'USD',
  'pdt_starter_placeholder', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["1,500 AI credits per month", "Build ~50 full screens/mo", "Research-backed brief planner (Free)", "Figma export with custom styles", "Style reference matching", "Priority generation speed"]}'
),

(
  'Pro',
  'Agencies, hyper-active builders, design teams.',
  49.99,
  10000,
  'USD',
  'pdt_pro_placeholder', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["10,000 AI credits per month", "Build ~333 full screens/mo", "Research-backed brief planner (Free)", "Figma export & design assets", "Advanced multi-screen systems", "Direct team collaboration support"]}'
);