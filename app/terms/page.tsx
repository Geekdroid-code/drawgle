import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of Drawgle's AI mobile UI design service.",
};

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    content: (
      <>
        <p>
          These Terms of Service govern your access to and use of Drawgle, including its websites,
          design workspace, AI generation tools, curated designs, exports, and related services.
          By creating an account, purchasing a plan, or using Drawgle, you agree to these terms.
        </p>
        <p>
          If you use Drawgle for an organization, you represent that you have authority to accept
          these terms for that organization.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What Drawgle provides",
    content: (
      <>
        <p>
          Drawgle helps users create and refine mobile user interfaces from prompts, screenshots,
          visual references, curated design directions, and existing project context. Outputs may
          include editable screens, code, design tokens, navigation structures, visual assets, and
          project documentation.
        </p>
        <p>
          AI output is probabilistic. Drawgle does not guarantee that every output will be unique,
          error-free, production-ready without review, or suitable for a particular purpose.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and eligibility",
    content: (
      <>
        <LegalList>
          <li>You must be legally able to enter into these terms and provide accurate account information.</li>
          <li>You are responsible for activity performed through your account and for protecting your login credentials.</li>
          <li>You must promptly notify us if you believe your account has been compromised.</li>
          <li>You may not sell, transfer, or share access in a way that bypasses plan limits or security controls.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content and references",
    content: (
      <>
        <p>
          You retain ownership of prompts, uploaded references, images, project content, and other
          material you submit to Drawgle. You grant Drawgle a limited license to host, process,
          reproduce, transform, and transmit that material only as needed to operate, secure, and
          improve the service or comply with law.
        </p>
        <p>
          You must have the necessary rights to anything you upload or ask Drawgle to reproduce.
          Do not submit confidential, regulated, or sensitive personal information unless you are
          authorized to do so and accept the risks of processing it through an AI service.
        </p>
      </>
    ),
  },
  {
    id: "outputs",
    title: "AI outputs and commercial use",
    content: (
      <>
        <p>
          Subject to these terms and applicable law, you may use and commercially exploit outputs
          created for you. You are responsible for reviewing outputs before publishing, shipping,
          or relying on them, including checking accessibility, security, intellectual-property,
          licensing, and platform requirements.
        </p>
        <p>
          Similar or identical outputs may be generated for other users. Drawgle does not promise
          exclusivity or guarantee that an output will qualify for intellectual-property protection.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>You may not use Drawgle to:</p>
        <LegalList>
          <li>violate law, intellectual-property rights, privacy rights, or contractual obligations;</li>
          <li>create deceptive, fraudulent, abusive, exploitative, or harmful content;</li>
          <li>upload malware, probe the service, bypass security, or interfere with other users;</li>
          <li>resell access, scrape the service, or circumvent credits, rate limits, or subscription controls;</li>
          <li>misrepresent AI-generated output as independently verified professional advice.</li>
        </LegalList>
        <p>We may remove content or restrict accounts when reasonably necessary to protect Drawgle, users, or third parties.</p>
      </>
    ),
  },
  {
    id: "billing",
    title: "Subscriptions, credits, and billing",
    content: (
      <>
        <p>
          Paid plans provide a stated allocation of AI credits and service features. Credits measure
          usage and are deducted when eligible AI operations are performed. Prices, plan limits, and
          included features are shown at purchase and may change for future billing periods.
        </p>
        <LegalList>
          <li>Subscriptions renew automatically until canceled.</li>
          <li>You may schedule cancellation from your account; access continues until the end of the current paid period unless otherwise stated.</li>
          <li>Payments and applicable taxes are processed by Dodo Payments or another disclosed payment provider.</li>
          <li>Refund eligibility is governed by our <LegalLink href="/refunds-policy">Refund Policy</LegalLink>.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "templates",
    title: "Curated designs, Fork, and Remix",
    content: (
      <>
        <p>
          Drawgle may provide curated designs and reusable style presets. Fork creates an editable
          copy under your account. Remix applies generalized visual direction to your own brief.
          Curated designs remain subject to these terms and may not be redistributed as standalone
          templates or used to impersonate their source.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and service changes",
    content: (
      <>
        <p>
          We may update, suspend, limit, or discontinue features to improve the service, address
          security or legal concerns, or respond to third-party provider changes. We do not guarantee
          uninterrupted availability, permanent storage, or continued support for every model,
          framework, export format, or integration.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    content: (
      <>
        <p>
          You may stop using Drawgle at any time. We may suspend or terminate access for material
          breach, misuse, payment failure, security risk, or legal requirement. Where practical, we
          will provide notice and an opportunity to resolve the issue.
        </p>
        <p>
          Provisions that by their nature should survive termination, including ownership,
          disclaimers, limitations, and payment obligations, will survive.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    content: (
      <>
        <p>
          Drawgle is provided on an “as is” and “as available” basis to the maximum extent permitted
          by law. We disclaim implied warranties of merchantability, fitness for a particular
          purpose, non-infringement, and uninterrupted operation.
        </p>
        <p>
          To the maximum extent permitted by law, Drawgle will not be liable for indirect,
          incidental, special, consequential, exemplary, or punitive damages, lost profits, lost
          data, or business interruption. Drawgle&apos;s aggregate liability relating to the service
          will not exceed the amount you paid to Drawgle during the three months before the event
          giving rise to the claim.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    content: (
      <>
        <p>
          We may update these terms as Drawgle evolves. Material changes will be communicated through
          the service or by other reasonable means. Continued use after an update means you accept
          the revised terms.
        </p>
        <p>
          Questions about these terms may be sent to{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>.
          Our <LegalLink href="/privacy-policy">Privacy Policy</LegalLink> explains how we handle personal data.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal / Terms"
      title="Terms of Service"
      description="The rules that keep Drawgle useful, secure, and fair for everyone building with it."
      sections={sections}
    />
  );
}
