export type FaqEntry = { question: string; answer: string };

/** Visible on the homepage and mirrored in its FAQPage JSON-LD. Keep both in sync by using this list only. */
export const homeFaqs: FaqEntry[] = [
  {
    question: "What is an AI mobile app designer?",
    answer:
      "An AI mobile app designer turns a product brief or visual reference into editable mobile interface screens. Drawgle adds shared design tokens, navigation context, editable screen structure, and developer handoff files so the result can continue beyond a static mockup.",
  },
  {
    question: "How does Drawgle turn a text prompt into mobile app UI?",
    answer:
      "Describe the app, audience, visual direction, and screens you need in plain language. Drawgle asks a few focused questions, proposes a screen plan for your approval, creates a shared design system, and then generates connected mobile screens that remain editable.",
  },
  {
    question: "Can AI design a complete multi-screen mobile app flow?",
    answer:
      "Yes. Drawgle plans and generates a set of related screens instead of treating every screen as an isolated mockup. The flow shares navigation, product context, and design tokens across dashboards, detail views, forms, onboarding, and other screens.",
  },
  {
    question: "Can Drawgle rebuild a screenshot as editable UI?",
    answer:
      "Yes. Upload a UI screenshot in Image to UI mode and Drawgle rebuilds its layout as editable mobile screens with live HTML, design tokens, and components you can refine.",
  },
  {
    question: "What is the difference between screenshot recreation and a style reference?",
    answer:
      "Screenshot recreation rebuilds the reference layout as editable UI. Style Ref mode uses only the visual direction, such as typography, color, surfaces, and spacing, to create an original layout for your own product.",
  },
  {
    question: "Can I edit one element without regenerating a screen?",
    answer:
      "Yes. Select a card, button, section, image, or navigation element and describe the exact change. Drawgle refines that selection while preserving the rest of the screen and its shared design system.",
  },
  {
    question: "What does Drawgle export for developers?",
    answer:
      "Drawgle exports standalone Tailwind HTML and an Agent Pack containing screen files, design tokens, shared navigation, a manifest, Design.md, and implementation instructions for coding agents.",
  },
  {
    question: "Can I use Drawgle designs with Cursor, Claude Code, Copilot, or Codex?",
    answer:
      "Yes. Add the Agent Pack to your repository and ask your agent to read .drawgle/handoff.md. It gets the approved screens, design tokens, assets, navigation context, and implementation instructions. The coding agent still implements the application in your chosen stack.",
  },
  {
    question: "Does Drawgle export editable Figma layers?",
    answer:
      "No. Drawgle keeps designs editable in its own visual canvas and exports standalone Tailwind HTML plus an Agent Pack. If native Figma layers are required for your workflow, Drawgle does not currently replace that part of Figma.",
  },
  {
    question: "Does Drawgle generate React Native, Flutter, SwiftUI, or Kotlin code?",
    answer:
      "Not as a production source-code export. Drawgle exports Tailwind HTML and structured implementation context rather than a finished native application. Your developer or coding agent translates the approved design into the target framework.",
  },
  {
    question: "Is Drawgle an AI app builder or a mobile UI design tool?",
    answer:
      "Drawgle is an AI mobile UI design tool. It helps you plan, generate, edit, and hand off mobile app screens, but it does not build the backend, connect production data, or publish an app to the App Store or Google Play.",
  },
  {
    question: "Do I need a paid plan to start?",
    answer:
      "Planning is free: describe your app, answer the questions, and review the proposed screen flow. Generating and editing screens uses AI credits from a monthly plan, starting at $9 for 600 credits.",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  signal: string;
};

/** Builder quotes carried over verbatim from the previous landing page (components/landing/Testimonial.tsx). */
export const testimonials: Testimonial[] = [
  {
    quote:
      "bro i literally just screenshot a design i liked on twitter, uploaded it, and got clean tailwind code in like 40 seconds. usually i spend 3 hours crying over flexbox alignment. this is a cheat code.",
    name: "Sachin Singh",
    role: "Indie hacker, FitTrack",
    avatar: "/content/sachin.webp",
    signal: "Screenshot to Tailwind",
  },
  {
    quote:
      "so clean. normal ai code generators write absolute spaghetti code that breaks if you touch it. with this i just edited the primary color token and it synced across all pages. actually works.",
    name: "Vishnu Das",
    role: "Lead iOS engineer",
    avatar: "/content/vishnu.webp",
    signal: "Token syncing",
  },
  {
    quote:
      "did a client call yesterday, they wanted to change a button radius and background. usually that's a figma back and forth, but i just clicked the element on the canvas, tweaked the radius visually, and boom. approved.",
    name: "Sumesh",
    role: "Freelance product designer",
    avatar: "/content/sumesh.webp",
    signal: "Live canvas editing",
  },
  {
    quote:
      "i write good backend code but my designs always look like garbage from 2005. first time my project actually looks like a premium SaaS and i didn't have to hire a freelancer.",
    name: "Amela Rivera",
    role: "Full-stack bootstrapper",
    avatar: "/content/emma-thopmson.jpg",
    signal: "Designs look premium",
  },
  {
    quote:
      "the fact that i can select a single button, type 'make this stand out more' and it only edits that button instead of regenerating the entire page and ruining my design is just huge.",
    name: "Manoj",
    role: "Indie app builder",
    avatar: "/content/manoj.jpg",
    signal: "Point-and-click edits",
  },
  {
    quote:
      "honestly didn't expect much but i pasted a screenshot of an app ui i liked and it spit out production-ready code. saved me like 3 days of pixel pushing. absolute game changer.",
    name: "Matilda Rumera",
    role: "Indie app developer",
    avatar: "/content/rumera.jpg",
    signal: "Time saver",
  },
];

export type Plan = {
  name: string;
  badge: string;
  description: string;
  price: number;
  popular: boolean;
  cta: string;
  features: string[];
  capacity: string;
};

export const plans: Plan[] = [
  {
    name: "Starter",
    badge: "Good for trying out",
    description: "For founders and developers validating an app concept or designing a smaller mobile screen set.",
    price: 9,
    popular: false,
    cta: "Start Building Now",
    features: [
      "600 AI credits per month",
      "Generate ~30 full screens",
      "20 credits per new parent screen",
      "Screenshot reconstruction and style references",
      "Tailwind HTML and Agent Pack exports",
      "Commercial use permitted under the Terms",
    ],
    capacity: "~30 full screens/mo",
  },
  {
    name: "Pro",
    badge: "Best value",
    description: "Higher monthly capacity for active builders producing larger mobile UI projects.",
    price: 29,
    popular: true,
    cta: "Choose Pro Plan",
    features: [
      "2,400 AI credits per month",
      "Generate ~120 full screens",
      "All editor and export features",
      "Shared design tokens and navigation",
      "Selected element and region edits",
      "Commercial use permitted under the Terms",
    ],
    capacity: "~120 full screens/mo",
  },
  {
    name: "Studio",
    badge: "High capacity",
    description: "High monthly generation capacity for agencies, studios, and builders managing larger mobile UI workloads.",
    price: 79,
    popular: false,
    cta: "Choose Studio Plan",
    features: [
      "8,000 AI credits per month",
      "Generate ~400 full screens",
      "High-volume multi-screen planning",
      "Shared design tokens and navigation",
      "Tailwind HTML and Agent Pack exports",
      "Commercial use permitted under the Terms",
    ],
    capacity: "~400 full screens/mo",
  },
];
