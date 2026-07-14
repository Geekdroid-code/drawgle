export type GenerationBenchmarkCase = {
  id: string;
  category: "prompt" | "style" | "recreate" | "scope" | "historical";
  prompt: string;
};

const cases = (category: GenerationBenchmarkCase["category"], prompts: string[]) => prompts.map((prompt, index) => ({
  id: `${category}-${String(index + 1).padStart(2, "0")}`,
  category,
  prompt,
}));

export const GENERATION_V2_BENCHMARK_CASES: GenerationBenchmarkCase[] = [
  ...cases("prompt", [
    "Premium personal finance dashboard for freelancers with cash flow, invoices, tax reserve, and recent activity.",
    "Playful language learning app home screen for children with a lesson path and daily streak.",
    "Quiet luxury skincare routine app with morning products, progress, and dermatologist notes.",
    "High-density crypto portfolio app with holdings, allocation chart, alerts, and market movement.",
    "Modern pet care app with pet profile, upcoming medication, feeding plan, and vet appointments.",
    "Editorial travel journal with destination photography, trip timeline, and saved places.",
    "Fitness coaching dashboard with today's workout, recovery score, exercise sets, and progress chart.",
    "Premium recipe discovery app with seasonal hero, cuisine filters, and a dense recipe collection.",
    "Minimal focus timer with current session, daily history, projects, and distraction notes.",
    "Music discovery app with a bold featured release, listening activity, genres, and mini player.",
    "Healthcare appointment app with doctor discovery, upcoming visit, prescriptions, and test results.",
    "Fashion marketplace with editorial campaign imagery, category rail, products, and saved items.",
    "Smart home command center with rooms, climate, energy usage, scenes, and device warnings.",
    "Team project dashboard with milestones, workload, recent files, and urgent blockers.",
    "Photo restoration app home screen with restore, animate, quick tools, and recent work.",
  ]),
  ...cases("style", [
    "Apply the supplied playful illustrated education style to a photo restoration product home screen.",
    "Apply the supplied dark glass reference style to a personal banking dashboard.",
    "Use the reference's editorial typography and spacing for a travel itinerary screen.",
    "Use the reference's clay surfaces and warm depth for a habit tracker.",
    "Translate the reference's brutalist visual language into an event discovery app.",
    "Use the reference's colorful geometric cards for a children's learning dashboard.",
    "Apply the reference's monochrome luxury language to a fragrance store.",
    "Use the reference's dense data grammar for an investment portfolio.",
    "Apply the reference's floating dark navigation dock to a wellness dashboard.",
    "Use the reference's soft pastel hierarchy for an AI journaling app.",
    "Translate the reference's technical command-center style to smart home controls.",
    "Use the reference's photographic editorial style for recipe discovery.",
    "Apply the reference's high-contrast sports style to a workout plan.",
    "Use the reference's refined marketplace style for a headphone store.",
    "Apply the supplied reference style to four photo restoration product screens.",
  ]),
  ...cases("recreate", [
    "Recreate the supplied single-screen learning dashboard faithfully as editable UI.",
    "Recreate all visible screens in the supplied three-phone collage.",
    "Recreate the supplied banking dashboard including its chart geometry and navigation.",
    "Recreate the supplied onboarding screen with exact visual hierarchy and CTA placement.",
    "Recreate the supplied commerce product grid and filters.",
    "Recreate the supplied map tracking screen with its overlays and bottom sheet.",
    "Recreate the supplied profile screen with its statistics and media grid.",
    "Recreate the supplied dark analytics screen with all visible data regions.",
    "Recreate the supplied checkout screen with exact containment and totals.",
    "Recreate the supplied calendar screen with visible event density and states.",
  ]),
  ...cases("scope", [
    "Create two onboarding screens, one login screen, and one home screen.",
    "Build a 3-step onboarding, a combined login/signup screen, dashboard, and settings screen.",
    "I need one splash screen, two authentication screens, and four root product screens.",
    "Make Screen 1: Welcome. Screen 2: Permissions. Screen 3: Home.",
    "Create one home screen with eight product cards and three quick actions.",
    "Build two different people-directory screens plus one person detail screen.",
    "Design four screens: feed, search, saved, and profile.",
    "Create a two-step checkout flow, one confirmation screen, and one order tracking screen.",
    "Make one dashboard and three separate report screens.",
    "Create five screens from this app brief, including onboarding, auth, home, library, and profile.",
  ]),
  ...cases("historical", [
    "Photo restoration app with 2 step thoughtfully planned onboarding screen, one login/signup screen and 1 home screen.",
    "Eight-cookie bakery grid where one correct cookie image may repeat across every product card.",
    "Workout dashboard where berry, food, and unrelated product imagery must never appear.",
    "People directory where every avatar must be a person and identities must remain distinct.",
    "Headphone store where audio products cannot be substituted with generic electronics.",
    "Pet care dashboard where product, food, and person images cannot fill pet portraits.",
    "Finance dashboard with no decorative berry or unrelated stock imagery.",
    "Dark floating navigation reference that must remain dark on a light app canvas.",
    "Dense eight-product commerce grid with no empty image placeholders.",
    "Three-screen reference collage whose analysis must return three complete frame records.",
  ]),
];
