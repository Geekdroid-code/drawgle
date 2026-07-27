import Image from "next/image";
import Link from "next/link";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import styles from "@/app/draft-landing/draft-landing.module.css";

const screens = [
  { src: "/showcase-screenshots/neo-mint/dashboard.webp", alt: "Drawgle generated finance dashboard", label: "Dashboard" },
  { src: "/showcase-screenshots/neo-mint/expense.webp", alt: "Drawgle generated expense screen", label: "Expenses" },
  { src: "/showcase-screenshots/neo-mint/calendar.webp", alt: "Drawgle generated finance calendar", label: "Calendar" },
];

export function DraftLandingSections() {
  return (
    <main className={styles.page}>
      <div className={styles.topline}>
        <Link href="/" className={styles.brand}><DrawgleLogo /><span>drawgle</span></Link>
        <span>landing study / 02</span>
      </div>

      <section className={styles.featuresSection}>
        <SectionHeading eyebrow="CONTROL IS THE FEATURE" title={<>Not another <strong>one-shot</strong> UI generator</>} copy="Fast generation is useful. A product that still makes sense after the fifth screen is better." />
        <div className={styles.featureGrid}>
          <article className={`${styles.featureCell} ${styles.featureOne}`}>
            <FeatureCopy number="01" title="Start from anything" copy="Generate from a prompt, rebuild a screenshot as editable UI, or use any interface as visual inspiration." />
            <div className={`${styles.conceptVisual} ${styles.sourceConcept}`} aria-hidden="true">
              <svg viewBox="0 0 400 300" fill="none">
                <defs>
                  <linearGradient id="engine-glass" x1="188" y1="70" x2="230" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="#5D5D5A" /><stop offset=".16" stopColor="#242424" /><stop offset=".55" stopColor="#090909" /><stop offset=".82" stopColor="#30302F" /><stop offset="1" stopColor="#111" /></linearGradient>
                  <linearGradient id="engine-channel" x1="208" y1="76" x2="208" y2="224" gradientUnits="userSpaceOnUse"><stop stopColor="#C9ECFF" stopOpacity=".2" /><stop offset=".42" stopColor="#5CB9F5" /><stop offset=".55" stopColor="#1B7FCC" /><stop offset="1" stopColor="#0B4D80" stopOpacity=".25" /></linearGradient>
                  <radialGradient id="engine-core"><stop stopColor="#DDF3FF" /><stop offset=".3" stopColor="#64C5FF" /><stop offset=".7" stopColor="#1B7FCC" /><stop offset="1" stopColor="#0A416A" /></radialGradient>
                  <filter id="engine-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>

                <path className={`${styles.engineInput} ${styles.engineInputOne}`} d="M28 72H100C132 72 149 94 176 94" />
                <path className={`${styles.engineInput} ${styles.engineInputTwo}`} d="M28 150H143" />
                <path className={`${styles.engineInput} ${styles.engineInputThree}`} d="M28 228H100C132 228 149 206 176 206" />
                <text className={styles.engineInputLabel} x="28" y="59">PROMPT</text>
                <text className={styles.engineInputLabel} x="28" y="137">SCREENSHOT</text>
                <text className={styles.engineInputLabel} x="28" y="215">REFERENCE</text>
                <g className={styles.engineSourceNodes}><circle cx="100" cy="72" r="3" /><circle cx="100" cy="150" r="3" /><circle cx="100" cy="228" r="3" /></g>
                

                <g className={styles.engineMark} transform="rotate(30 208 150)">
                  <rect className={styles.engineMarkShadow} x="199" y="85" width="18" height="130" rx="9" />
                  <rect className={styles.engineMarkShadow} x="199" y="85" width="18" height="130" rx="9" transform="rotate(60 208 150)" />
                  <rect className={styles.engineMarkShadow} x="199" y="85" width="18" height="130" rx="9" transform="rotate(120 208 150)" />
                  <rect className={styles.engineBar} x="199" y="85" width="18" height="130" rx="9" />
                  <rect className={styles.engineBar} x="199" y="85" width="18" height="130" rx="9" transform="rotate(60 208 150)" />
                  <rect className={styles.engineBar} x="199" y="85" width="18" height="130" rx="9" transform="rotate(120 208 150)" />
                  <rect className={styles.engineChannel} x="206.25" y="90" width="3.5" height="120" rx="1.75" />
                  <rect className={styles.engineChannel} x="206.25" y="90" width="3.5" height="120" rx="1.75" transform="rotate(60 208 150)" />
                  <rect className={styles.engineChannel} x="206.25" y="90" width="3.5" height="120" rx="1.75" transform="rotate(120 208 150)" />
                  <circle className={styles.engineCoreHalo} cx="208" cy="150" r="17" />
                  <circle className={styles.engineCore} cx="208" cy="150" r="8" />
                  <circle cx="205.5" cy="147.5" r="1.8" fill="#fff" opacity=".82" />
                </g>
                <g className={styles.enginePorts}><circle cx="176" cy="94" r="3" /><circle cx="143" cy="150" r="3" /><circle cx="176" cy="206" r="3" /></g>

                <path className={styles.engineOutputBeam} d="M273 150H300" />
                <circle className={styles.engineOutputNode} cx="300" cy="150" r="4" />
                <g className={styles.sourceOutput}><text x="318" y="125">OUTPUT</text><text x="318" y="151">EDITABLE</text><text x="318" y="170">UI</text><path d="M318 184H367" /></g>
              </svg>
            </div>          </article>

          <article className={`${styles.featureCell} ${styles.featureTwo}`}>
            <FeatureCopy number="02" title="Design connected flows" copy="Generate multiple screens with shared navigation and one visual language, so every flow feels like the same product." />
            <div className={`${styles.conceptVisual} ${styles.flowConcept}`} aria-hidden="true">
              <svg viewBox="0 0 400 300" fill="none">
                <defs>
                  <linearGradient id="flow-paper-a" x1="36" y1="76" x2="132" y2="242" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#E7E7E3" /></linearGradient>
                  <linearGradient id="flow-paper-b" x1="115" y1="72" x2="203" y2="245" gradientUnits="userSpaceOnUse"><stop stopColor="#E5E5E1" /><stop offset=".46" stopColor="#FAFAF8" /><stop offset="1" stopColor="#D1D1CD" /></linearGradient>
                  <linearGradient id="flow-paper-c" x1="197" y1="89" x2="291" y2="233" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#E2E2DE" /></linearGradient>
                  <linearGradient id="flow-paper-d" x1="285" y1="75" x2="371" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#E1E1DD" /><stop offset=".48" stopColor="#FAFAF8" /><stop offset="1" stopColor="#CFCFCB" /></linearGradient>
                </defs>

                <path className={styles.flowAccordionShadow} d="M29 101L111 78L200 96L289 78L371 101V241L289 219L200 241L111 219L29 241V101Z" />
                <g className={styles.flowAccordion}>
                  <path className={styles.flowPanelOne} d="M29 88L111 66V219L29 241V88Z" />
                  <path className={styles.flowPanelTwo} d="M111 66L200 88V241L111 219V66Z" />
                  <path className={styles.flowPanelThree} d="M200 88L289 66V219L200 241V88Z" />
                  <path className={styles.flowPanelFour} d="M289 66L371 88V241L289 219V66Z" />
                  <path className={styles.flowFoldHighlight} d="M111 67V218M200 89V240M289 67V218" />

                  <g className={styles.flowPanelIndex}><text x="40" y="105">01</text><text x="123" y="88">02</text><text x="212" y="105">03</text><text x="301" y="88">04</text></g>
                  <g className={styles.flowPanelTitle}><text x="40" y="122">HOME</text><text x="123" y="105">EXPENSES</text><text x="212" y="122">CALENDAR</text><text x="301" y="105">INSIGHTS</text></g>
                  <g className={styles.flowPanelGlyph}><text x="40" y="181">H</text><text x="123" y="164">$</text><text x="212" y="181">12</text><text x="301" y="164">%</text></g>
                  <g className={styles.flowPanelRule}><path d="M40 191H93" /><path d="M123 174H179" /><path d="M212 191H268" /><path d="M301 174H354" /></g>

                  <path className={styles.flowNavUnderlay} d="M29 213L111 191L200 213L289 191L371 213" />
                  <path className={styles.flowNavSpine} d="M29 213L111 191L200 213L289 191L371 213" />
                  <g className={styles.flowNavNodes}><circle cx="70" cy="202" r="4" /><circle cx="155" cy="202" r="4" /><circle cx="244" cy="202" r="4" /><circle cx="330" cy="202" r="4" /></g>
                </g>
                <text className={styles.flowAccordionCaption} x="200" y="274" textAnchor="middle">4 CONNECTED SCREENS / 1 SHARED NAVIGATION</text>
              </svg>
            </div>          </article>

          <article className={`${styles.featureCell} ${styles.featureThree}`}>
            <FeatureCopy number="03" title="Update every screen at once" copy="Change color, type, spacing, radii, or shadows once. Every connected screen updates live—no regeneration." />
            <div className={`${styles.conceptVisual} ${styles.dialConcept}`} aria-hidden="true">
              <svg viewBox="0 0 400 300" fill="none">
                <defs><radialGradient id="dial-metal" cx="0" cy="0" r="1" gradientTransform="translate(166 110) rotate(49) scale(187)"><stop stopColor="#FFF" /><stop offset=".48" stopColor="#E8E8E4" /><stop offset=".82" stopColor="#B9B9B5" /><stop offset="1" stopColor="#F7F7F4" /></radialGradient><radialGradient id="dial-face"><stop stopColor="#303030" /><stop offset="1" stopColor="#0B0B0B" /></radialGradient><filter id="dial-shadow" x="50" y="10" width="300" height="320"><feDropShadow dx="0" dy="23" stdDeviation="16" floodOpacity=".25" /></filter></defs>
                <g><circle cx="200" cy="170" r="118" fill="url(#dial-metal)" stroke="#AFAFAC" /><circle cx="200" cy="170" r="101" stroke="#8D8D89" strokeDasharray="1 8" strokeLinecap="round" /><circle cx="200" cy="170" r="78" fill="url(#dial-face)" stroke="#5C5C59" /><path d="M142 118A78 78 0 0 1 248 109" stroke="#1B7FCC" strokeWidth="7" strokeLinecap="round" /></g>
                <g className={styles.dialTicks}><path d="M200 40V54M330 170H316M200 300V286M70 170H84" /><path d="M108 78L118 88M292 78L282 88M292 262L282 252M108 262L118 252" /></g>
                <g className={styles.dialLabels}><text x="200" y="30" textAnchor="middle">COLOR</text><text x="345" y="174">TYPE</text><text x="200" y="297" textAnchor="middle">SPACE</text><text x="18" y="174">RADIUS</text></g>
                <text className={styles.dialKicker} x="200" y="150" textAnchor="middle">MASTER TOKEN</text><text className={styles.dialValue} x="200" y="183" textAnchor="middle">04/04</text><text className={styles.dialStatus} x="200" y="205" textAnchor="middle">SCREENS SYNCED</text>
                <circle cx="200" cy="170" r="5" fill="#1B7FCC" /><path d="M200 170L166 122" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </article>

          <article className={`${styles.featureCell} ${styles.featureFour}`}>
            <FeatureCopy number="04" title="Edit one element in place" copy="Select any card, button, section, or navigation item. Drawgle changes only that part and preserves everything around it." />
            <div className={`${styles.conceptVisual} ${styles.scopeConcept}`} aria-hidden="true">
              <div className={styles.scopeDocument}>
                <div className={styles.scopeHeader}><span>SCREEN / DASHBOARD</span><small>EDIT MODE</small></div>
                <div className={styles.scopeLocked}><span>navigation</span><small>LOCKED</small></div>
                <div className={styles.scopeSelection}><small>SELECTED BLOCK</small><strong>analytics.card</strong><p>Make the comparison more compact.</p><i /><i /><i /><i /></div>
                <div className={styles.scopeLocked}><span>recent activity</span><small>LOCKED</small></div>
                <div className={styles.scopeLocked}><span>bottom navigation</span><small>LOCKED</small></div>
                <div className={styles.scopeFooter}><span>1 BLOCK EDITING</span><small>REST OF SCREEN PRESERVED</small></div>
              </div>
            </div>
          </article>

          <article className={`${styles.featureCell} ${styles.featureFive}`}>
            <FeatureCopy number="05" title="Export a build-ready handoff" copy="Download standalone Tailwind HTML plus an Agent Pack with design tokens, assets, screens, a manifest, and implementation instructions." />
            <div className={`${styles.conceptVisual} ${styles.exportConcept}`} aria-hidden="true">
              <svg viewBox="0 0 400 320" fill="none">
                <defs>
                  <linearGradient id="export-paper" x1="58" y1="26" x2="342" y2="269" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#ECEDEA" /></linearGradient>
                  <linearGradient id="export-edge" x1="200" y1="36" x2="200" y2="264" gradientUnits="userSpaceOnUse"><stop stopColor="#62C2FA" /><stop offset=".46" stopColor="#167BC5" /><stop offset="1" stopColor="#07558D" /></linearGradient>
                  <linearGradient id="export-metal" x1="187" y1="105" x2="214" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#F8F8F5" /><stop offset=".35" stopColor="#8B8E8E" /><stop offset=".62" stopColor="#F2F3F0" /><stop offset="1" stopColor="#535656" /></linearGradient>
                  <filter id="export-inset-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
                  <clipPath id="export-left-clip"><path d="M58 29Q58 24 63 24H196V122C189 155 175 207 157 266H63Q58 266 58 261V29Z" /></clipPath>
                  <clipPath id="export-right-clip"><path d="M204 24H337Q342 24 342 29V261Q342 266 337 266H243C225 207 211 155 204 122V24Z" /></clipPath>
                </defs>

                <g className={styles.exportPackage}>
                  <path className={styles.exportLeftLeaf} fill="url(#export-paper)" d="M58 29Q58 24 63 24H196V122C189 155 175 207 157 266H63Q58 266 58 261V29Z" />
                  <path className={styles.exportRightLeaf} fill="url(#export-paper)" d="M204 24H337Q342 24 342 29V261Q342 266 337 266H243C225 207 211 155 204 122V24Z" />
                  <g clipPath="url(#export-left-clip)"><path className={styles.exportInsetShadow} filter="url(#export-inset-blur)" d="M58 29Q58 24 63 24H196V122C189 155 175 207 157 266H63Q58 266 58 261V29Z" /></g>
                  <g clipPath="url(#export-right-clip)"><path className={styles.exportInsetShadow} filter="url(#export-inset-blur)" d="M204 24H337Q342 24 342 29V261Q342 266 337 266H243C225 207 211 155 204 122V24Z" /></g>

                  <path className={styles.exportLeftTape} stroke="url(#export-edge)" d="M193 27V121C187 154 174 207 157 264" />
                  <path className={styles.exportRightTape} stroke="url(#export-edge)" d="M207 27V121C213 154 226 207 243 264" />
                  <path className={styles.exportLeftTeeth} d="M197 34V119C191 153 178 206 161 262" />
                  <path className={styles.exportRightTeeth} d="M203 34V119C209 153 222 206 239 262" />

                  <path className={styles.exportTopRule} d="M76 65H184M216 65H324" />
                  <g className={styles.exportProjectMark}>
                    <path d="M82 39V55M75 43L89 51M75 51L89 43" />
                    <circle cx="82" cy="47" r="2.5" />
                  </g>
                  <text className={styles.exportProjectLabel} x="98" y="45">DRAWGLE PROJECT</text>
                  <text className={styles.exportProjectMeta} x="98" y="56">ONE COMPLETE PRODUCT</text>
                  <text className={styles.exportProjectMeta} x="323" y="50" textAnchor="end">EXPORT / 05</text>

                  <g className={styles.exportLeftContent}>
                    <text className={styles.exportDeliverableIndex} x="77" y="99">01 / CODE</text>
                    <text className={styles.exportDeliverableTitle} x="77" y="119">TAILWIND</text>
                    <text className={styles.exportDeliverableTitle} x="77" y="139">HTML</text>
                    <path className={styles.exportCodeRule} d="M77 153H136" />
                    <text x="77" y="171">&lt;main class=</text>
                    <text x="77" y="183">&quot;grid gap-6&quot;&gt;</text>
                    <text x="77" y="195">&nbsp;&nbsp;&lt;section /&gt;</text>
                    <text x="77" y="207">&lt;/main&gt;</text>
                  </g>

                  <g className={styles.exportRightContent}>
                    <text className={styles.exportDeliverableIndex} x="263" y="99">02 / CONTEXT</text>
                    <text className={styles.exportDeliverableTitle} x="263" y="119">AGENT</text>
                    <text className={styles.exportDeliverableTitle} x="263" y="139">PACK</text>
                    <path className={styles.exportCodeRule} d="M263 153H323" />
                    <text x="263" y="171">tokens.json</text>
                    <text x="263" y="183">assets/</text>
                    <text x="263" y="195">screens/</text>
                    <text x="263" y="207">manifest.json</text>
                  </g>

                  <g className={styles.exportPull}>
                    <rect x="187" y="108" width="26" height="25" rx="6" fill="url(#export-metal)" />
                    <rect x="193" y="113" width="14" height="9" rx="4.5" />
                    <path d="M193 129L185 151Q183 157 189 159L200 163L211 159Q217 157 215 151L207 129" fill="url(#export-metal)" />
                    <path className={styles.exportPullMark} d="M200 143V154M195 146L205 152M195 152L205 146" />
                  </g>

                  <text className={styles.exportReadyLabel} x="200" y="235" textAnchor="middle">READY</text>
                  <text className={styles.exportReadyLabel} x="200" y="246" textAnchor="middle">TO BUILD</text>
                </g>
                <text className={styles.exportCaption} x="200" y="312" textAnchor="middle">UNZIP ONCE / KEEP THE CODE AND THE CONTEXT</text>
              </svg>
            </div>          </article>

          <article className={`${styles.featureCell} ${styles.featurePlaceholder}`} aria-hidden="true" />
        </div>
      </section>

      <section className={styles.boardsSection}>
        <SectionHeading eyebrow="THE SYSTEM TRAVELS" title={<>Every screen belongs to the <strong>same product</strong></>} copy="The brief, design rules, navigation, and prior work move together—so each new screen arrives with context." />
        <div className={styles.boardScrollField}>
          <div className={`${styles.boardZone} ${styles.boardZoneOne}`}>
            <article className={`${styles.productBoard} ${styles.planBoard}`}>
              <BoardBar index="01" title="Approved screen plan" meta="5 routes" /><div className={styles.boardGrid} />
              <div className={styles.planMap}><div className={styles.mapStart}><DrawgleLogo /><span>Product brief</span></div><svg viewBox="0 0 720 380" fill="none" aria-hidden="true"><path d="M117 186C178 186 196 92 268 92M117 186C183 186 205 186 268 186M117 186C178 186 196 280 268 280M416 92C475 92 490 186 552 186M416 280C475 280 490 186 552 186" /></svg><MapScreen className={styles.mapScreenOne} index="01" title="Home" meta="dashboard" /><MapScreen className={styles.mapScreenTwo} index="02" title="Expenses" meta="history" /><MapScreen className={styles.mapScreenThree} index="03" title="Calendar" meta="planning" /><MapScreen className={styles.mapScreenFour} index="04" title="Insights" meta="analysis" /><div className={styles.planStamp}>REVIEWED</div></div>
            </article>
          </div>

          <div className={`${styles.boardZone} ${styles.boardZoneTwo}`}>
            <article className={`${styles.productBoard} ${styles.tokensBoard}`}>
              <BoardBar index="02" title="Approved design system" meta="24 decisions" /><div className={styles.boardGrid} />
              <div className={styles.typeSpecimen}><span>DISPLAY / 52</span><strong>Clarity<br />over clutter.</strong></div>
              <div className={styles.tokenRail}><span className={styles.tokenBlack}>#111111</span><span className={styles.tokenBlue}>#1B7FCC</span><span className={styles.tokenPaper}>#F8F8F6</span></div>
              <div className={styles.componentSpecimen}><span>COMPONENT / PRIMARY ACTION</span><button type="button">Review spending</button><small>radius 12 · medium 14 · icon 16</small></div>
            </article>
          </div>

          <div className={`${styles.boardZone} ${styles.boardZoneThree}`}>
            <article className={`${styles.productBoard} ${styles.screensBoard}`}>
              <BoardBar index="03" title="Generated product flow" meta="system aligned" /><div className={styles.boardGrid} />
              <div className={styles.boardScreens}>{screens.map((screen) => <figure key={screen.src}><div><Image src={screen.src} alt={screen.alt} fill sizes="210px" className={styles.screenImage} /></div><figcaption><span>{screen.label}</span><small>✓ aligned</small></figcaption></figure>)}</div>
              <div className={styles.boardNote}><DrawgleLogo /><span>One memory. One system. One product.</span></div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.detailsSection}>
        <SectionHeading eyebrow="SMALL DETAILS, REAL CONTROL" title={<>Designed for the work <strong>after generate</strong></>} copy="The quiet safeguards are what turn a fast concept into a product direction a team can keep using." />
        <div className={styles.detailList}>
          <DetailRow label="01 / CONSISTENCY" title="Every screen snaps back to the system" copy="Approved spacing, type, and component rules keep visual decisions from wandering as the project grows." visual={<div className={styles.alignmentDemo} aria-hidden="true"><span className={styles.guideVertical} /><span className={styles.guideHorizontal} /><div className={styles.alignedScreenOne} /><div className={styles.alignedScreenTwo} /><div className={styles.measureX}>24</div><div className={styles.measureY}>16</div></div>} />
          <DetailRow label="02 / MEMORY" title="The right context returns at the right time" copy="Drawgle retrieves the useful parts of prior screens and conversations without forcing the whole project into every prompt." visual={<div className={styles.contextStack} aria-hidden="true"><div className={styles.contextCardBack}>PROJECT CHARTER</div><div className={styles.contextCardMiddle}>SCREEN MEMORY / 03</div><div className={styles.contextCardFront}><DrawgleLogo /><span>Relevant context found</span><strong>6 decisions carried forward</strong></div></div>} />
          <DetailRow label="03 / SAFE EDITS" title="Change the block, not the whole product" copy="Edits stay scoped, navigation stays intact, and the result is checked before it becomes the new source of truth." visual={<div className={styles.auditDemo} aria-hidden="true"><div className={styles.auditBefore}><span>before</span><i /><i /><i /></div><div className={styles.auditArrow}>→</div><div className={styles.auditAfter}><span>after</span><i /><i /><i /></div><div className={styles.auditSeal}>AUDITED</div></div>} />
        </div>
        <div className={styles.endnote}><span>End of prototype</span><Link href="/">Return to current landing page ↗</Link></div>
      </section>
    </main>
  );
}

function MockTopbar({ title, meta }: { title: string; meta: string }) { return <div className={styles.mockTopbar}><div className={styles.mockDots}><i /><i /><i /></div><span>{title}</span><small>{meta}</small></div>; }
function MiniScreen({ variant }: { variant: "dashboard" | "expenses" | "calendar" }) { return <div className={styles.miniScreen} data-variant={variant}><div className={styles.miniNav}><i /><span /><span /></div><strong /><div className={styles.miniBlocks}><i /><i /><i /></div><div className={styles.miniRows}><span /><span /></div></div>; }
function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: React.ReactNode; copy: string }) { return <header className={styles.sectionHeading}><div className={styles.headingLine}><span /><h2>{title}</h2></div><p className={styles.eyebrow}>{eyebrow}</p><p className={styles.sectionCopy}>{copy}</p></header>; }
function FeatureCopy({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className={styles.featureCopy}><h3>{title}</h3><span>{number}</span><p>{copy}</p></div>; }
function BoardBar({ index, title, meta }: { index: string; title: string; meta: string }) { return <header className={styles.boardBar}><div className={styles.windowDots}><i /><i /><i /></div><span>{index} / {title}</span><small>{meta}</small></header>; }
function MapScreen({ className, index, title, meta }: { className: string; index: string; title: string; meta: string }) { return <div className={`${styles.mapScreen} ${className}`}><span>{index}</span><strong>{title}</strong><small>{meta}</small></div>; }
function DetailRow({ label, title, copy, visual }: { label: string; title: string; copy: string; visual: React.ReactNode }) { return <article className={styles.detailRow}><div className={styles.detailVisual}>{visual}</div><div className={styles.detailCopy}><span>{label}</span><h3>{title}</h3><p>{copy}</p></div></article>; }