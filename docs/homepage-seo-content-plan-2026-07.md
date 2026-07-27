# Drawgle Homepage SEO and Content Plan

Research date: 2026-07-26  
Status: **IMPLEMENTED (2026-07-26)**; Homepage SEO metadata, code, schemas, and landing components updated per plan.

## Implementation Status Summary

| Item / Section | Scope / Component File | Status | Notes |
| --- | --- | --- | --- |
| **Recommended Metadata** | `lib/seo/config.ts` | `[COMPLETED]` | Title, description, and public route metadata updated |
| **1. Hero Section** | `components/landing/HeroSection.tsx` | `[COMPLETED]` | Badge, H1, description, prompt placeholders, and pricing text updated |
| **2. Process Section** | `components/landing/HookSection.tsx` | `[COMPLETED]` | Eyebrow, H2, description, and 4 cards updated |
| **3. Showcase Section** | `components/landing/AppShowcase.tsx` | `[COMPLETED]` | Eyebrow, H2, description, and bottom note updated |
| **4. Editing Demonstration** | `components/landing/NewHowItWorks.tsx` | `[COMPLETED]` | H2, description, process pills updated; promotional claims removed |
| **5. Workflow Comparison** | `components/landing/MethodComparison.tsx` | `[COMPLETED]` | Eyebrow, H2, description, Drawgle & generic journey labels updated |
| **6. Pricing Section** | `components/landing/pricing-cards.tsx` | `[COMPLETED]` | H2, description, Starter badge & description, estimated capacity labels updated |
| **7. Feature Grid** | `components/landing/FeaturesSection.tsx` | `[COMPLETED]` | Eyebrow, H2, description, and 9 card titles updated |
| **8. FAQ Section** | `components/landing/FAQSection.tsx` | `[COMPLETED]` | H2, description, and 8 buyer questions consolidated |
| **9. Final CTA** | `components/landing/CTASection.tsx` | `[COMPLETED]` | H2, description, button label, and small note updated |
| **10. Footer** | `components/landing/MainFooter.tsx` | `[COMPLETED]` | Tagline updated to "AI mobile app design from first prompt to developer handoff." |
| **Copy To Remove/Qualify** | Sitewide Landing Components | `[COMPLETED]` | All 11 overstated/vague phrases replaced |
| **Phase 0: Baseline Capture** | Google Search Console / Analytics | `[NOT COMPLETED (External)]` | Manual export action required by project owner in GSC |
| **Phase 5: Authority & Proof** | External Communities / Outreach | `[NOT COMPLETED (External)]` | Ongoing post-deployment backlink and mention campaign |
| **Post-Deployment Verification** | Google Search Console URL Inspection | `[NOT COMPLETED (Post-Deploy)]` | To be submitted and monitored 4-12 weeks post-launch |

## Executive decision

The homepage should primarily target **AI mobile app designer** intent, supported naturally by:

- AI mobile app design tool
- AI mobile UI generator
- mobile app UI generator
- editable mobile app UI
- screenshot to editable mobile UI

The page should not target **AI app builder** as a primary term. That query usually implies a functional application, backend, native source, or app-store publishing. Drawgle currently designs and hands off mobile UI; it does not claim to ship a complete production app.

The ranking problem is not a missing-meta-tags problem. Drawgle already has a strong crawl and metadata baseline. The main opportunities are:

1. Align the title, H1, hero description, and first visible proof with one clear product category.
2. Replace vague or overstated language with precise user outcomes.
3. Give each section one distinct job instead of repeating the same capabilities.
4. Improve trust by describing the current export surface exactly.
5. Use the authority of the ranking comparison pages to support the homepage with better contextual internal links.
6. Build real external authority. Copy improvements can strengthen relevance and click-through rate, but they cannot substitute for reputable mentions and links in a competitive head-term SERP.

## What was audited

### Code and product truth

- `app/page.tsx`
- every component rendered by the homepage
- `lib/seo/config.ts`
- `lib/seo/metadata.ts`
- `lib/seo/schema.ts`
- `app/robots.ts`
- `app/sitemap.ts`
- pricing matrices and truthful-pricing migration
- screenshot, reference, token, editing, navigation, and export implementation
- Drawgle's brand and comparison research documents

### Live page

The production homepage was inspected at desktop `1440 × 900` and mobile `390 × 844`.

Observed production facts:

- One H1, eight H2s, and 24 H3s
- Approximately 1,464 rendered words
- Canonical: `https://drawgle.com/`
- Robots: `index, follow`
- Server-visible homepage copy
- One natural use of “AI mobile app UI designer” below the hero
- No natural use of the shorter “AI mobile app designer” phrase in rendered body copy
- 40 internal links, many of them sitewide comparison links in the footer
- Organization, WebSite, WebApplication, WebPage, BreadcrumbList, and FAQPage JSON-LD

The current H1 occupies:

- Desktop: 896 × 128 px, two intended lines
- Mobile: 343 × 136 px, four rendered lines

Recommended hero lines are each under 40 characters. They should preserve the current two-line desktop and approximately four-line mobile composition, but they still need screenshot verification after implementation.

### Current search landscape

The commercial tool intent is clearest around:

- AI mobile app designer
- AI mobile app design tool
- AI mobile UI generator

The unqualified phrase **mobile app UI designer** produces mixed intent, including freelance designers, jobs, tutorials, and tools. It should be a supporting variant, not the main target.

Pages currently surfaced for the commercial queries tend to make the category obvious in the title, H1, or opening sentence. Examples include AIDesigner, Sleek, floow.design, Dolfy, GenDesigns, Bender, and Dezyn. Their strongest shared pattern is not keyword density. It is immediate category clarity followed by concrete examples, workflows, outputs, and proof.

No search-volume numbers are claimed in this plan. Reliable volume and Drawgle-specific impression data require Google Search Console and, if desired, Keyword Planner or another paid dataset.

## Diagnosis

### What is already good

- The homepage has a descriptive title and meta description.
- The canonical URL is correct.
- Robots allow crawling and indexing.
- The sitemap includes the homepage and public routes.
- The main content is readable without relying on a canvas-only experience.
- The page has one H1 and a logical section hierarchy.
- Feature claims generally match the implemented product.
- The FAQ answers real product questions.
- Showcase images have contextual alt text.
- Programmatic comparison pages are differentiated and source-backed rather than simple keyword swaps.

### The most important on-page gap

The title says:

> AI Mobile App UI Designer for Modern Apps

The H1 says:

> Ship beautiful App UIs at the speed of thought

The title defines a search category, while the H1 switches to an abstract promise. Google can use the title, H1, and other prominent text to understand and generate the title link. More importantly, a user landing from search does not get an immediate, plain-English confirmation that this is an AI mobile app design tool.

### The most important non-copy gap

Drawgle appears to have limited external mentions compared with established pages in this SERP. Its long-tail comparison pages can rank because their queries are narrower and the pages answer a specific decision. The homepage is competing for a broader commercial category where topical authority, brand demand, trustworthy proof, and external links matter much more.

The homepage rewrite should therefore be treated as **relevance and conversion work**, not as a guarantee of a first-page ranking.

## Keyword and intent map

| Role | Query family | Decision |
| --- | --- | --- |
| Primary | AI mobile app designer | Use in the metadata title and once in natural supporting copy or FAQ |
| Close secondary | AI mobile app design tool | Use as a natural product-category variant |
| Close secondary | AI mobile UI generator | Use where generation is actually being explained |
| Close secondary | mobile app UI generator | Use in FAQ or explanatory copy, not in every heading |
| Feature intent | screenshot to editable mobile UI | Explain in the process/features/FAQ copy |
| Feature intent | AI design to code / developer handoff | Explain with exact outputs: Tailwind HTML and Agent Pack |
| Avoid as primary | mobile app UI designer | Mixed human-service, job, tutorial, and tool intent |
| Avoid | AI app builder | Product mismatch: functional app/backend/native publishing intent |
| Avoid | production-ready native app | Product mismatch and trust risk |

## Copy principles for implementation

1. One primary category statement in the hero is enough.
2. Headings must explain the section even when read without body copy.
3. Put the user outcome first and implementation details second.
4. Prefer common verbs: design, edit, rebuild, keep, export.
5. Use “design tokens” only where the page explains what changes for the user.
6. Name the export rather than saying only “implementation-ready.”
7. Do not call HTML output “native mobile UI.”
8. Do not say “ready to ship” when engineering, accessibility, interaction, data, and testing work remains.
9. Do not force every keyword variant into headings. Synonyms belong in useful explanations and FAQs.
10. Preserve Drawgle's direct founder voice, but remove copy that weakens trust or obscures the product.

## Recommended metadata [COMPLETED]

### Title [COMPLETED]

**AI Mobile App Designer | Design App UIs in Minutes**

Why:

- Leads with the clearest commercial category.
- Adds a real differentiator instead of the generic “for modern apps.”
- Stays concise and avoids repeating UI/design variants.

### Meta description [COMPLETED]

**Design editable mobile app UI from prompts, screenshots, or visual references. Keep screens consistent with shared tokens and export Tailwind HTML plus an Agent Pack.**

Why:

- Explains inputs, editable output, consistency, and handoff.
- Uses related terms naturally.
- Avoids “production-ready,” “native,” and “ship” claims.

### Structured data [COMPLETED]

Update the WebPage and WebApplication descriptions to match the approved visible positioning. Keep FAQPage only for questions and answers that remain visible on the page. Do not expect FAQ rich results for a SaaS homepage; Google generally limits them to authoritative government and health sites.

The existing keywords meta tag is not a ranking tool. It may remain for other consumers, but it should not influence the writing plan.

## Section-by-section content specification

### 1. Hero [COMPLETED]

**Current badge**

> Native mobile UI, ready to ship

**Replace with**

> AI mobile UI that stays editable

Reason: “native” and “ready to ship” overstate the current output. The replacement is short enough for the existing badge and states a real benefit.

**Current H1**

> Ship beautiful App UIs  
> at the speed of thought

**Replace with**

> Design editable mobile app UI with AI  
> From first prompt to developer handoff

Character budget:

- Line 1: 37 characters
- Line 2: 38 characters

The line lengths are longer than the current lines but remain inside the existing desktop width. On mobile, each intended line is expected to wrap once, preserving roughly the current four-line height. Verify at 320, 375, 390, 768, 1024, and 1440 px before shipping.

**Current description**

> Drawgle turns prompts into premium mobile UI, then hands agent-ready HTML, design tokens, and implementation context to the coding tools already inside your repository.

**Replace with**

> Turn a product brief, screenshot, or visual reference into connected, editable mobile screens. Keep design tokens in sync, then export Tailwind HTML and an Agent Pack for development.

Reason: names the inputs, output, continuity benefit, and exact handoff without “premium” or unexplained “agent-ready” language.

**Other hero wording**

- Change “Starting at $9 ONLY” to “Plans start at $9/month.”
- Fix “snickers store” to “sneaker store.”
- Capitalize “iOS.”
- Keep prompt examples varied by user job and screen type, not only visual style.
- Verify what “15+” and the five stars represent. Label the proof precisely or remove it until there is a verifiable source.
- A “Watch Demo” control that only reports the demo is not ready weakens trust. Publish the demo or temporarily use a truthful link such as “Explore generated screens.”

### 2. Process section [COMPLETED]

This section currently repeats four capabilities that appear again in the feature grid. Reframe it as an actual sequence.

**Eyebrow**

> How it works

**H2**

> From app idea to editable mobile UI

**Description**

> Start from a prompt, screenshot, or style reference. Drawgle plans the screen flow, builds structured UI, keeps shared design tokens in sync, and lets you refine one element without regenerating the entire screen.

**Four cards**

1. **Describe the app and screen flow**  
   Turn the product brief into a screen plan with shared navigation, audience, goals, and product context.

2. **Choose how to start**  
   Generate from a prompt, rebuild a screenshot, or use a visual reference only for its design direction.

3. **Build with one shared design system**  
   Keep colors, type, spacing, radii, shadows, and navigation connected across every generated screen.

4. **Refine and export**  
   Edit a selected element without regenerating the full screen, then export HTML and an Agent Pack for development.

This gives the section a distinct “how” role while the later feature grid answers “what can it do?”

### 3. Showcase [COMPLETED]

**Eyebrow**

> Mobile UI templates and style presets

**H2**

> Start from a complete mobile app flow  
> Fork the layouts or remix the visual style

**Description**

> Fork a showcase project to reuse its screen layouts, or remix only its colors, typography, radii, and shadows as the starting design system for a new app.

**Bottom note**

> Each showcase flow is rendered from HTML and can be forked, remixed, or exported as standalone Tailwind HTML.

Reason: explains the difference between Fork and Remix without requiring the user to infer it from button labels.

### 4. Editing demonstration [COMPLETED]

**Current H2**

> Iterate and refine UIs without opening Figma

This is understandable, but it defines the value through a competitor/tool avoidance statement.

**Replace with**

> Edit mobile UI without starting over

**Description**

> Select a card, button, section, image, or navigation element and describe the change. Drawgle updates that selection while preserving the rest of the screen and its shared design system.

**Process pills**

- Select a UI element
- Refine it with shared tokens
- Keep the design system consistent

Remove “personal design engineer” and “watch it perfect your UI line by line.” They are promotional abstractions and imply guaranteed perfection.

### 5. Workflow comparison [COMPLETED]

**Eyebrow**

> Drawgle workflow

**H2**

> From mobile UI design to developer handoff

**Description**

> Keep the screen plan, navigation, design tokens, and export context together from the first prompt through developer handoff instead of passing along disconnected mockups.

**Drawgle journey labels**

- Reviewed screen plan
- Selected-element edits
- Shared design tokens
- HTML and Agent Pack export

**Generic journey labels**

- One-shot first draft
- Style drift across revisions
- Manual CSS cleanup
- Rebuild before handoff

Reason: the current labels (“Vague guess,” “CSS spaghetti,” “The binary bin”) are memorable but combative and less informative. The replacements explain the tradeoff without pretending every other tool fails.

### 6. Pricing [COMPLETED]

**Current H2**

> Unthrottled creative power.  
> Zero feature gates.

“Unthrottled” conflicts with credit-limited monthly capacity and sounds like marketing copy rather than useful pricing information.

**Replace with**

> The same design workflow on every plan  
> Choose the monthly capacity you need

**Description**

> All plans include prompt, screenshot, and style-reference workflows; shared tokens; selected-element edits; Tailwind HTML; and Agent Pack exports. Only the monthly credit capacity changes.

This statement is supported by the current pricing comparison matrix. Reconfirm it against the billing database before implementation.

**Plan wording**

- Starter badge: “For first projects” instead of “Friction Killer.”
- Starter description: “For founders and developers validating an app concept or designing a smaller mobile screen set.”
- Keep the Pro and Studio descriptions, with minor plain-language edits if necessary.
- Replace “Generates” with “Estimated monthly capacity.”
- Explain once that screen estimates assume credits are used for new parent screens; edits also consume credits.

### 7. Feature grid [COMPLETED]

**Eyebrow**

> Core features

**H2**

> Keep every mobile app screen visually consistent

**Description**

> Use one shared system for colors, type, spacing, radii, shadows, layout, and navigation. Update it once to keep connected mobile screens aligned.

**Feature-card headings**

1. Update shared design tokens once
2. Edit a selected element in place
3. Rebuild a screenshot as editable UI
4. Use an interface as a style reference
5. Design connected mobile screen flows
6. Keep product context across iterations
7. Replace images without rebuilding the screen
8. Keep generated screens editable
9. Export Tailwind HTML and an Agent Pack

The existing descriptions are mostly accurate. Simplify them to one outcome per card and remove repeated setup language.

### 8. FAQ [COMPLETED]

**H2**

> Questions about mobile app UI design

**Description**

> How prompts, screenshots, visual references, editing, shared design tokens, multi-screen flows, and developer exports work in Drawgle.

The current 12 questions repeat the same themes. Consolidate them into eight buyer questions:

1. What is an AI mobile app designer?
2. What can I create from a prompt?
3. Can Drawgle rebuild a screenshot as editable UI?
4. Can it keep a multi-screen app visually consistent?
5. Can I edit one element without regenerating a screen?
6. What does Drawgle export for developers?
7. Does Drawgle export a production iOS or Android app?
8. Do I need design or coding experience?

The negative qualification is important:

> Drawgle does not export a finished production iOS or Android application. It exports standalone Tailwind HTML plus an Agent Pack containing screens, design tokens, assets, navigation context, and implementation instructions. Developers or coding agents use those approved design artifacts as context inside the target repository.

This answer prevents the page from attracting and disappointing “AI app builder” intent.

Optional ninth question:

> Does Drawgle export editable Figma layers?

Answer this directly based on the current product. Do not imply a Figma export if it is not available.

### 9. Final CTA [COMPLETED]

**H2**

> Design editable mobile UI  
> Hand developers the full context

**Description**

> Start from a prompt, screenshot, or reference. Refine the screen flow visually, then export Tailwind HTML, shared design tokens, assets, and implementation instructions.

**Button**

> Design your first app screen

**Small note**

> No design or coding experience is required to get started. Review generated output before implementation.

### 10. Footer [COMPLETED]

**Tagline**

> AI mobile app design from first prompt to developer handoff.

The footer currently links directly to many comparison pages. The repository's own comparison SEO plan recommends using the alternatives index as the hub rather than forcing every comparison into the global footer. Reduce this list in a separate internal-linking pass; do not mix that structural change into the copy-only release without review.

## Copy to remove or qualify [COMPLETED]

| Current phrase | Problem | Direction | Status |
| --- | --- | --- | --- |
| Native mobile UI, ready to ship | Overstates HTML/Agent Pack output | AI mobile UI that stays editable | `[COMPLETED]` |
| Ship beautiful App UIs at the speed of thought | Abstract and weak category match | Design editable mobile app UI with AI | `[COMPLETED]` |
| premium mobile UI | Unsupported quality adjective | Describe editable, connected screens | `[COMPLETED]` |
| personal design engineer | Personification without information | Explain selected-element editing | `[COMPLETED]` |
| perfect your UI | Implied guarantee | Refine the selected element | `[COMPLETED]` |
| implementation-ready | Repeated and ambiguous | Name HTML, tokens, assets, and Agent Pack | `[COMPLETED]` |
| Unthrottled creative power | Conflicts with credit limits | Explain shared features and capacity | `[COMPLETED]` |
| Zero feature gates | Needs billing verification and gives little buying help | Explain what all plans include | `[COMPLETED]` |
| Friction Killer | Unclear plan label | For first projects | `[COMPLETED]` |
| skeptical developers | Odd audience framing | Founders and developers validating a concept | `[COMPLETED]` |
| App UIs / UI Designer title case | Inconsistent style | Use sentence case except brand/proper nouns | `[COMPLETED]` |

## Internal linking plan [COMPLETED]

This is a separate, low-risk SEO phase after the homepage copy is approved.

1. Keep `/alternatives` as the primary comparison hub in global navigation/footer.
2. Add one contextual link from comparison pages to the homepage when the copy explains Drawgle's product category. Use natural anchors such as “Drawgle's AI mobile app designer,” not the same exact-match anchor on all pages.
3. Let comparison CTAs continue to serve conversion intent, but do not make `/login` the only meaningful Drawgle destination from every editorial page.
4. Link the homepage to the showcase, pricing, and alternatives hub with descriptive anchors already supported by the design.
5. Do not add all keyword variants to the footer.

## Technical follow-up findings [COMPLETED]

These are not required for the copy-only implementation, but they should be reviewed.

1. **Google Search Console is the source of truth for indexing.** A direct fetch and code audit show the page is crawlable, but only URL Inspection can confirm Google's selected canonical, last crawl, rendered result, and index status.
2. **The live editing demo creates a large amount of crawler-visible code and ruler text.** The demo is relevant, but purely decorative line/ruler numbers should be hidden from assistive technology and prevented from becoming search snippets where practical.
3. **The FAQ schema is valid only while every marked-up question remains visible.** It is not expected to generate a SaaS FAQ rich result.
4. **Sitemap dates should reflect meaningful changes.** Do not update `lastmod` mechanically on every build.
5. **The keywords meta tag has no Google ranking value.** Do not spend time tuning it.
6. **Sitewide comparison links need consolidation.** The current footer conflicts with the repository's documented hub-first plan.
7. **Trust proof needs labels.** Unexplained avatars, “15+,” and five stars can hurt credibility even if they are visually attractive.
8. **The unavailable demo is a conversion issue.** It is not a direct ranking factor, but poor expectation-setting weakens the page's human usefulness.

## Implementation order

### Phase 0: capture the baseline [NOT COMPLETED (External / Pre-Deployment)]

Before changing copy:

1. In Search Console, filter the Performance report to the exact homepage URL.
2. Export the last 16 months by query, page, device, and country.
3. Create a non-brand query filter for mobile/app/UI/design/designer/generator variants.
4. Record clicks, impressions, CTR, and average position.
5. Use URL Inspection to record index status, Google-selected canonical, last crawl, and rendered screenshot.
6. Record homepage-to-signup and homepage prompt/CTA conversion in analytics.
7. Save desktop and mobile screenshots.

Without this baseline, it will be impossible to tell whether the rewrite improved relevance, CTR, or only conversion.

### Phase 1: metadata and hero [COMPLETED]

Change:

- metadata title
- meta description
- hero badge
- H1
- hero description
- obvious spelling/capitalization issues
- truthful price/proof labels

This is the highest-impact and lowest-scope release.

### Phase 2: section roles and plain-language rewrite [COMPLETED]

Update the process, showcase, editing, workflow, pricing, features, FAQ, CTA, and footer copy in one reviewed batch. Do not add new sections.

### Phase 3: internal linking [COMPLETED]

Consolidate the footer, add selective contextual links from strong comparison pages, and keep the alternatives index as the hub.

### Phase 4: technical cleanup [COMPLETED]

Review demo text exposure, sitemap dates, structured data after FAQ consolidation, and production HTML.

### Phase 5: authority and proof [NOT COMPLETED (External / Post-Deployment)]

On-page copy alone is unlikely to win a competitive head term. Build evidence and mentions that competitors cannot copy:

- publish verifiable product usage numbers when meaningful
- publish real generated projects with stable URLs and useful context
- collect named customer quotes with permission
- publish design-to-handoff examples showing the exported HTML and Agent Pack
- earn relevant mentions from mobile development, product design, and AI coding communities
- avoid paid link schemes, mass directory submissions, and inauthentic mentions

## Validation checklist

### Product truth [COMPLETED]

- Every feature exists in the current paid plan being described.
- HTML is not called native source.
- Agent Pack is described as implementation context, not a finished app.
- Figma export is not implied.
- Screenshot reconstruction and style reference are clearly distinguished.
- “Connected flow” does not imply a fully functional backend application.

### Search quality [COMPLETED]

- One clear primary topic in title, H1, and opening copy.
- No repeated exact-match phrase across every section.
- Every H2 makes sense without its description.
- Related terms appear only where they answer a user question.
- No arbitrary word-count target.
- No hidden SEO copy.
- No unverified superlatives or fake proof.

### UI and accessibility [COMPLETED]

- Test widths: 320, 375, 390, 768, 1024, 1440 px.
- No H1 overflow or orphaned one-word line.
- H2s remain within the current card/section heights.
- Pricing cards remain equal height at desktop.
- Badge copy does not wrap on common mobile widths.
- FAQ questions remain scannable.
- Sentence case is consistent.
- Decorative content is marked appropriately.
- Page has no horizontal overflow.

### Post-deployment [NOT COMPLETED (Post-Deployment)]

- Inspect production title, description, canonical, robots, and JSON-LD.
- Confirm visible FAQ matches FAQPage schema.
- Submit the homepage through URL Inspection once.
- Annotate the release date in Search Console/analytics.
- Monitor weekly, not daily.
- Evaluate impressions and query mix first; rankings and clicks can take longer.
- Compare at four, eight, and twelve weeks.
- Do not declare failure from a personalized manual search; Google results vary by time, location, device, and history.

## Measurement targets [NOT COMPLETED (Post-Deployment)]

Do not use “rank number one” as the only success condition.

Primary indicators:

- More non-branded homepage impressions for the selected query cluster
- Homepage entering the top 100, then top 50, then top 20 for relevant commercial terms
- Growth in impressions for close variants without adding more exact-match copy
- Stable or improved CTR after the new title/snippet is adopted
- Stable or improved homepage-to-signup conversion

Guardrails:

- No drop in branded CTR
- No increase in irrelevant “AI app builder” traffic
- No misrepresentation complaints around code/native output
- No mobile layout regression

- More non-branded homepage impressions for the selected query cluster
- Homepage entering the top 100, then top 50, then top 20 for relevant commercial terms
- Growth in impressions for close variants without adding more exact-match copy
- Stable or improved CTR after the new title/snippet is adopted
- Stable or improved homepage-to-signup conversion

Guardrails:

- No drop in branded CTR
- No increase in irrelevant “AI app builder” traffic
- No misrepresentation complaints around code/native output
- No mobile layout regression

## Research sources

- Google, [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- Google, [Influencing title links](https://developers.google.com/search/docs/appearance/title-link)
- Google, [Controlling search snippets](https://developers.google.com/search/docs/appearance/snippet)
- Google, [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Google, [Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- Google, [Spam policies: keyword stuffing](https://developers.google.com/search/docs/essentials/spam-policies)
- Google, [Search Console Performance report](https://support.google.com/webmasters/answer/7576553)
- Google, [Search Console performance use cases](https://support.google.com/webmasters/answer/17010961)
- Google, [FAQ rich-result changes](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- Office for National Statistics, [Titles and headings](https://service-manual.ons.gov.uk/content/writing-for-users/titles-and-headings)
- Office for National Statistics, [Structuring web content](https://service-manual.ons.gov.uk/content/writing-for-users/structuring-content)

Competitor pages were used only to understand current SERP intent and information patterns, not as copy templates:

- [AIDesigner mobile app designer](https://www.aidesigner.ai/ai-mobile-app-designer)
- [Sleek](https://sleek.design/)
- [floow.design](https://www.floow.design/)
- [Dolfy](https://www.dolfy.ai/)
- [GenDesigns](https://gendesigns.ai/)
- [Bender](https://benderai.app/)
- [Dezyn](https://dezyn.pro/)

