export type ShowcaseScreen = {
  id: string;
  label: string;
  role: string;
  src: string;
  screenshot: string;
};

export type ShowcaseCollection = {
  id: string;
  index: string;
  name: string;
  description: string;
  prompt: string;
  templateSlug?: string;
  stylePresetSlug?: string;
  palette: string[];
  landingFeatured?: boolean;
  screens: ShowcaseScreen[];
};

const screen = (
  collectionId: string,
  id: string,
  label: string,
  role: string,
  src: string,
): ShowcaseScreen => ({
  id,
  label,
  role,
  src,
  screenshot: `/showcase-screenshots/${collectionId}/${id}.webp`,
});

export const showcaseCollections: ShowcaseCollection[] = [
  {
    id: "neo-mint",
    index: "01",
    name: "Neo Mint",
    description: "High-contrast finance screens with sharp hierarchy and restrained mint energy.",
    prompt: "Design a high-contrast black and mint finance app with a dashboard, calendar analytics, and expense detail.",
    palette: ["#000000", "#FFFFFF", "#4ADE80", "#E55B5B"],
    landingFeatured: true,
    screens: [
      screen("neo-mint", "dashboard", "Dashboard", "Overview", "/screens/NeoMintPremium/Dashboard.html"),
      screen("neo-mint", "calendar", "Calendar", "Analytics", "/screens/NeoMintPremium/CalendarAnalytics.html"),
      screen("neo-mint", "expense", "Expense", "Detail", "/screens/NeoMintPremium/ExpenseDetail.html"),
    ],
  },
  {
    id: "minimal-habit-premium",
    index: "02",
    name: "Quiet Habit",
    description: "A serene habit system with disciplined spacing and calm progress views.",
    prompt: "Create a premium minimalist habit tracker with a habit dashboard, history, and focused analytics.",
    palette: ["#F5F1E8", "#FFFFFF", "#23211D", "#A9B59B"],
    landingFeatured: true,
    screens: [
      screen("minimal-habit-premium", "habits", "Habits", "Dashboard", "/screens/PremiumMinimalistHabit/HabitDashboard.html"),
      screen("minimal-habit-premium", "history", "History", "Progress", "/screens/PremiumMinimalistHabit/History.html"),
      screen("minimal-habit-premium", "analytics", "Analytics", "Insight", "/screens/PremiumMinimalistHabit/Analytics.html"),
    ],
  },
  {
    id: "fintech", index: "03", name: "Fintech",
    description: "Expressive financial analytics shaped for fast reading and confident decisions.",
    prompt: "Create a premium fintech app with profit analytics, sales overview, and wallet transactions.",
    palette: ["#070707", "#FFFFFF", "#F0D49A", "#A9DBC0"],
    screens: [
      screen("fintech", "profit", "Profit", "Analytics", "/screens/Fintech/ProfitAnalytics.html"),
      screen("fintech", "sales", "Sales", "Overview", "/screens/Fintech/SalesOverview.html"),
      screen("fintech", "wallet", "Wallet", "Transactions", "/screens/Fintech/WalletTransactions.html"),
    ],
  },
  {
    id: "onyx-performance", index: "04", name: "Onyx Performance",
    description: "Focused performance screens shaped by contrast, energy, and control.",
    prompt: "Build a focused dark performance app with a home dashboard, guided routine, and precise settings.",
    palette: ["#000000", "#121212", "#32D74B", "#F2F2F2"],
    screens: [
      screen("onyx-performance", "home", "Home", "Momentum", "/screens/OnyxPerformance/Home.html"),
      screen("onyx-performance", "routine", "Routine", "Guidance", "/screens/OnyxPerformance/Routine.html"),
      screen("onyx-performance", "settings", "Settings", "Control", "/screens/OnyxPerformance/Settings.html"),
    ],
  },
  {
    id: "food-delivery", index: "05", name: "Food Delivery",
    description: "Warm commerce screens that make discovery, selection, and ordering feel effortless.",
    prompt: "Design a premium food delivery app with a discovery home, food detail, and order tracking.",
    palette: ["#FFF9F1", "#FFFFFF", "#191713", "#E8753D"],
    landingFeatured: true,
    screens: [
      screen("food-delivery", "home", "Home", "Discovery", "/screens/FoodDelivery/Home.html"),
      screen("food-delivery", "food", "Food", "Detail", "/screens/FoodDelivery/FoodDetail.html"),
      screen("food-delivery", "orders", "Orders", "Tracking", "/screens/FoodDelivery/Orders.html"),
    ],
  },
  {
    id: "premium-ecom", index: "06", name: "Premium Commerce",
    description: "Editorial product presentation with a polished, conversion-focused purchase journey.",
    prompt: "Create a premium ecommerce app with an editorial storefront and detailed product experience.",
    palette: ["#F5F0E8", "#FFFFFF", "#181714", "#C8A96A"],
    screens: [
      screen("premium-ecom", "store", "Store", "Home", "/screens/PremiumEcom/Home.html"),
      screen("premium-ecom", "product", "Product", "Detail", "/screens/PremiumEcom/ProductDetail.html"),
    ],
  },
  {
    id: "gamification", index: "07", name: "Gamification",
    description: "Energetic progression screens with clear goals, rewards, and social momentum.",
    prompt: "Design a polished gamification app with a home dashboard, challenges, and leaderboard.",
    palette: ["#131313", "#FFFFFF", "#F3C84B", "#E86B52"],
    screens: [
      screen("gamification", "home", "Home", "Progress", "/screens/Gamification/Home.html"),
      screen("gamification", "challenges", "Challenges", "Goals", "/screens/Gamification/Challenges.html"),
      screen("gamification", "leaderboard", "Leaderboard", "Social", "/screens/Gamification/Leaderboard.html"),
    ],
  },
  {
    id: "midnight-bakery", index: "08", name: "Midnight Bakery",
    description: "A characterful dark storefront with warm product storytelling and tactile depth.",
    prompt: "Create a premium dark bakery app with a storefront and richly presented product screens.",
    palette: ["#11100F", "#F3E8D7", "#C98B51", "#7A4B2C"],
    screens: [
      screen("midnight-bakery", "home", "Home", "Storefront", "/screens/MidnightBakery/Home.html"),
      screen("midnight-bakery", "collection", "Collection", "Browse", "/screens/MidnightBakery/NewScreen1.html"),
      screen("midnight-bakery", "product", "Product", "Detail", "/screens/MidnightBakery/NewScreen2.html"),
    ],
  },
  {
    id: "smart-home", index: "09", name: "Smart Home",
    description: "A calm control environment balancing household context with precise device actions.",
    prompt: "Design a modern smart home controller with overview, room detail, and device control screens.",
    palette: ["#F1F0EB", "#FFFFFF", "#20221F", "#B8C8B1"],
    screens: [
      screen("smart-home", "home", "Home", "Overview", "/screens/SmartHome/HomeOverview.html"),
      screen("smart-home", "room", "Room", "Detail", "/screens/SmartHome/RoomDetail.html"),
      screen("smart-home", "device", "Device", "Control", "/screens/SmartHome/DeviceControl.html"),
    ],
  },
  {
    id: "running-tracker", index: "10", name: "Running Tracker",
    description: "High-energy fitness screens built around motion, metrics, and personal momentum.",
    prompt: "Create a premium running tracker with welcome, live run tracking, and health dashboard.",
    palette: ["#10110F", "#FFFFFF", "#C7FF35", "#6D7B57"],
    screens: [
      screen("running-tracker", "welcome", "Welcome", "Start", "/screens/RunningTracker/WelcomeScreen.html"),
      screen("running-tracker", "run", "Run", "Tracking", "/screens/RunningTracker/RunningTracker.html"),
      screen("running-tracker", "health", "Health", "Dashboard", "/screens/RunningTracker/HealthDashboard.html"),
    ],
  },
  {
    id: "midnight-precision", index: "11", name: "Midnight Precision",
    description: "Disciplined monochrome screens with a sharp, editorial visual language.",
    prompt: "Create a precise monochrome productivity app with welcome, login, and structured dashboard.",
    palette: ["#0A0A0A", "#1A1A1A", "#FFFFFF", "#444444"],
    screens: [
      screen("midnight-precision", "welcome", "Welcome", "Introduction", "/screens/MidnightPrecision/Welcome.html"),
      screen("midnight-precision", "sign-in", "Sign in", "Access", "/screens/MidnightPrecision/Login.html"),
      screen("midnight-precision", "dashboard", "Dashboard", "Workspace", "/screens/MidnightPrecision/Dashboard.html"),
    ],
  },
  {
    id: "minimalist-habit", index: "12", name: "Minimal Habit",
    description: "Clean habit-building screens with a focused path from intent to measurable progress.",
    prompt: "Design a minimalist habit tracker with welcome, dashboard, and habit progress detail.",
    palette: ["#FAFAF7", "#FFFFFF", "#171715", "#D1D8C7"],
    screens: [
      screen("minimalist-habit", "welcome", "Welcome", "Start", "/screens/MinimalistHabit/Welcome.html"),
      screen("minimalist-habit", "dashboard", "Dashboard", "Habits", "/screens/MinimalistHabit/Dashboard.html"),
      screen("minimalist-habit", "progress", "Progress", "Detail", "/screens/MinimalistHabit/HabitDetailsProgress.html"),
    ],
  },
  {
    id: "security", index: "13", name: "Calm Security",
    description: "Trust-centered security screens that feel precise without becoming cold.",
    prompt: "Design a calm security app with watchtower dashboard, private vault, and add-item flow.",
    palette: ["#F9F9F7", "#FFFFFF", "#121212", "#B9D8C2"],
    screens: [
      screen("security", "watchtower", "Watchtower", "Status", "/screens/Security/WatchtowerDashboard.html"),
      screen("security", "vault", "Vault", "Library", "/screens/Security/ItemsVault.html"),
      screen("security", "add-item", "Add item", "Action", "/screens/Security/AddNewItem.html"),
    ],
  },
  {
    id: "modern-dark-fintech", index: "14", name: "Dark Fintech",
    description: "A deep financial interface with layered surfaces and focused account intelligence.",
    prompt: "Create a modern dark fintech app with dashboard, insights, and card management.",
    palette: ["#090A0C", "#17191D", "#F4F5F7", "#78BFA5"],
    screens: [
      screen("modern-dark-fintech", "dashboard", "Dashboard", "Overview", "/screens/ModernDarkFintech/Dashboard.html"),
      screen("modern-dark-fintech", "insights", "Insights", "Analytics", "/screens/ModernDarkFintech/Insights.html"),
      screen("modern-dark-fintech", "card", "Card", "Management", "/screens/ModernDarkFintech/MyCard.html"),
    ],
  },
  {
    id: "neobank", index: "15", name: "Neobank",
    description: "A refined digital banking experience with clear control and intelligent insights.",
    prompt: "Design a premium neobank app with dashboard, card management, and financial insights.",
    palette: ["#F2F3EE", "#FFFFFF", "#171817", "#B9CE9B"],
    landingFeatured: true,
    screens: [
      screen("neobank", "dashboard", "Dashboard", "Overview", "/screens/Neobank/Dashboard.html"),
      screen("neobank", "cards", "Cards", "Management", "/screens/Neobank/CardManagement.html"),
      screen("neobank", "insights", "Insights", "Analytics", "/screens/Neobank/Insights.html"),
    ],
  },
  {
    id: "petcare", index: "16", name: "Petcare",
    description: "Friendly care screens balancing warmth, daily tasks, and useful health records.",
    prompt: "Create a premium pet care app with pet dashboard, daily checklist, and health log.",
    palette: ["#F1F8F6", "#FFFFFF", "#24302D", "#E7B896"],
    screens: [
      screen("petcare", "dashboard", "Dashboard", "Pet", "/screens/Petcare/PetDashboard.html"),
      screen("petcare", "daily-care", "Daily care", "Checklist", "/screens/Petcare/DailyCareChecklist.html"),
      screen("petcare", "health", "Health", "Vet log", "/screens/Petcare/HealthVetLog.html"),
    ],
  },
  {
    id: "soft-financial", index: "17", name: "Soft Financial",
    description: "Gentle financial surfaces that make cards, spending, and insights approachable.",
    prompt: "Design a soft premium finance tracker with home, card detail, and spending insights.",
    palette: ["#F6F4F0", "#FFFFFF", "#262522", "#D4BCA2"],
    screens: [
      screen("soft-financial", "home", "Home", "Overview", "/screens/SoftFinancialTracker/Home.html"),
      screen("soft-financial", "card", "Card", "Wallet", "/screens/SoftFinancialTracker/MyCard.html"),
      screen("soft-financial", "insights", "Insights", "Analytics", "/screens/SoftFinancialTracker/Insights.html"),
    ],
  },
  {
    id: "soft-tech", index: "18", name: "Soft Tech",
    description: "A restrained social workspace with considered rhythm and hierarchy.",
    prompt: "Create a premium soft-tech collaboration app with home, activity feed, and chat thread.",
    palette: ["#F5F5F5", "#FFFFFF", "#111111", "#D7E6DD"],
    screens: [
      screen("soft-tech", "home", "Home", "Workspace", "/screens/SoftTechPremium/Home.html"),
      screen("soft-tech", "activity", "Activity", "Updates", "/screens/SoftTechPremium/ActivityFeed.html"),
      screen("soft-tech", "chat", "Chat", "Conversation", "/screens/SoftTechPremium/ChatThread.html"),
    ],
  },
];

const landingCollectionOrder = [
  "minimal-habit-premium",
  "neo-mint",
  "neobank",
  "food-delivery",
];

export const landingShowcaseCollections = landingCollectionOrder.map((id) => {
  const collection = showcaseCollections.find((item) => item.id === id && item.landingFeatured);
  if (!collection) throw new Error(`Missing featured showcase collection: ${id}`);
  return collection;
});

export const getTemplateSlug = (collection: ShowcaseCollection) => collection.templateSlug ?? collection.id;
export const getStylePresetSlug = (collection: ShowcaseCollection) => collection.stylePresetSlug ?? collection.id;

export const curatedShowcaseScreenCount = showcaseCollections.reduce(
  (total, collection) => total + collection.screens.length,
  0,
);
