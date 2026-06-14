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
  'Starter',
  'Skeptical devs, casual indie hackers, validating concepts.',
  9.00,
  600,
  'USD',
  'pdt_0NfVsOAPfZoweqsMUTDRV', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["600 AI credits per month", "Generate ~30 full screens/mo", "Standard build speeds", "AI-powered element edits", "Agent-ready HTML & design context", "Project Agent Packs"]}'
),

(
  'Pro',
  'Startups, active developers, active builders.',
  29.00,
  2400,
  'USD',
  'pdt_0NfVsaqDDfwFUMDiaUMrY', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["2,400 AI credits per month", "Generate ~120 full screens/mo", "Priority generation speed", "Advanced screen layout options", "Full commercial license", "Premium customer support"]}'
),

(
  'Studio',
  'Agencies, hyper-active builders, design teams.',
  79.00,
  8000,
  'USD',
  'pdt_0NfVsiGMq1HWz9VuGcTxR', -- Replaceable in Dodo Dashboard
  true,
  '{"features": ["8,000 AI credits per month", "Generate ~400 full screens/mo", "Ultra-priority processing", "Agency & team collaboration", "Custom design system presets", "Dedicated account manager"]}'
);
