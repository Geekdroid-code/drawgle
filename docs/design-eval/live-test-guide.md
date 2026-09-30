# Live test, as real users

After this branch is merged and deployed, create these projects on the live site as ten different kinds of user. Each costs real model money, roughly 20 to 50 cents a project; users 1 to 5 are the important ones.

## Before you start

Wait until both deploys have finished, or you will be testing half-old code:

- **Trigger.dev:** GitHub → Actions → "Deploy Trigger.dev" shows a green tick for the merge commit.
- **Web app:** the Vercel dashboard shows the production deployment of the merge commit as Ready.

## The test users

Each one is a different kind of person with a different way of asking. Type their request as a new project, go through the approval card as they would, and let it build.

| # | Who | What they type | What it tests |
| --- | --- | --- | --- |
| 1 | **Riya**, first-time founder, says as little as possible | `An app for booking private jet charters` | A one-line idea still gets a premium, coherent design. "Jet" is a product, not a black theme. |
| 2 | **Arjun**, product manager, writes a full spec | `An invoice tracker for freelancers. Screens: a dashboard with this month's earnings, the invoice list, creating an invoice, and a client's page. Use navy blue as the main colour, the Inter font, and rounded cards with a subtle shadow.` | His colour, font and shadow win over the reference's. |
| 3 | **Meera**, owns a coffee shop, thinks in her customers' numbers | `A loyalty app for my coffee shop. Customers collect points (like 1,250 pts), see past orders such as Order #1042, and there is a weekly leaderboard.` | Numbers stay intact in the screens ("1,250 pts", "Order #1042"). The approval card offers a bottom bar, since there are areas people move between. |
| 4 | **Kabir**, writes the way he talks, in Hinglish | `ek dog walking app banao jahan owners apne kutte ke liye walker book kar sakein. dark theme aur neon green accent chahiye` | A request in another language still gets its colours. Dogs and people appear as photos, not initials. |
| 5 | **Sara**, a designer, brings an app she loves | Upload a screenshot of an app you like (App Store, Dribbble) as the style, and type `A habit tracker in this style` | The design follows her image, and building from her image does not delay the first screen by more than about a minute. |
| 6 | **Dev** wants a copy of a screen he saw | Upload one app screenshot, choose to recreate it (Image to UI), and type `Recreate this screen` | The mode that already worked well is still as faithful. |
| 7 | **Priya**, runs operations at a bank, thinks in steps | `A 4-step account opening flow for a bank: phone number, OTP, ID upload, success.` | The approval card says there is no bottom navigation, and no screen draws a tab bar of its own. |
| 8 | **Tom** runs a streetwear brand and knows exactly the look | `A sneaker drop app. Neo-brutalist: square corners, thick black borders and hard black offset shadows.` | A bold look the user asks for is not softened away: square corners and hard shadows. |
| 9 | **Ananya** makes learning apps for children | `A reading app for kids aged 6 to 9, with very rounded, bubbly cards and friendly colours.` | Rounder corners than the usual 24px are allowed when the user asks for them. |
| 10 | **Hari** keeps bees; his product is niche | `An app for beekeepers to log hive inspections and honey harvests.` | An unusual product still looks designed, not generic, and "honey" is read as a product word. |

## What to look at on every project

Give each project a score from 1 to 5: would you show it to a customer?

- **Approval card.** The screens fit the product. The navigation line is right: a bottom bar for apps with areas people move between, none for a step-by-step flow.
- **Overall look.** Premium, and one product across all its screens. It follows the chosen style, or the uploaded image.
- **Corners and shadows.** Cards are not all big 32px blobs. Shadows are light unless the user asked for bold ones.
- **Colours and fonts.** The ones the user asked for. Headings are not an old-fashioned serif (Times-like) unless asked. A title next to a back arrow is small and on one line.
- **Spacing.** Related things sit close together, and there is more room only before a new section. Nothing floats in empty space.
- **Text.** Real content, and no broken fragments such as "1,s" or "Maya s".
- **Photos.** People and animals are photos, not initials.
- **Bottom bar.** The same on every main screen, reaching the bottom edge when it is an attached bar. No extra tab bar inside a screen.
- **Speed.** Note the time from approving to the first screen, and to the last.

Projects you made before the merge are also worth a look: they should render as before, except that an attached bottom bar now reaches the bottom edge.

## What to send back

For each project: its number, its score, one or two screenshots, and anything that looked wrong. If a generation failed, the failed run in the Trigger.dev dashboard (Production → Runs) shows the error.

## If it has to be undone

Revert the merge commit on `main` rather than resetting it: in the pull request, click **Revert**, then merge the revert. Both deploys run again with the old code. Nothing in the database needs undoing: this release adds no migrations, and the old code ignores the few new fields it stores.
