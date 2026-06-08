import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Drawgle collects, uses, stores, and protects personal data.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope",
    content: (
      <p>
        This Privacy Policy explains how Drawgle collects, uses, shares, and retains personal data
        when you visit our website, create an account, purchase a plan, or use the design workspace.
      </p>
    ),
  },
  {
    id: "data-collected",
    title: "Information we collect",
    content: (
      <>
        <LegalList>
          <li><strong>Account data:</strong> email address, name, avatar, authentication identifiers, and account settings.</li>
          <li><strong>Project content:</strong> prompts, messages, generated screens and code, design tokens, project context, navigation plans, edits, and feedback.</li>
          <li><strong>Uploaded content:</strong> screenshots, visual references, images, filenames, and associated metadata.</li>
          <li><strong>Usage and technical data:</strong> feature activity, generation status, errors, device/browser information, IP address, and security logs.</li>
          <li><strong>Billing data:</strong> plan, subscription status, payment identifiers, invoices, billing details, and credit balance. Drawgle does not store complete payment-card numbers.</li>
          <li><strong>Communications:</strong> support requests and other messages you send us.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    content: (
      <>
        <LegalList>
          <li>provide, personalize, and maintain the design workspace;</li>
          <li>plan, generate, refine, store, and export your projects;</li>
          <li>authenticate accounts, process billing, and manage credits;</li>
          <li>secure the service, prevent abuse, troubleshoot failures, and enforce our terms;</li>
          <li>analyze and improve product performance and user experience;</li>
          <li>communicate service, billing, security, and support information;</li>
          <li>comply with law and protect the rights of users, Drawgle, and third parties.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "AI processing",
    content: (
      <>
        <p>
          Drawgle sends relevant prompts, project context, selected screen content, and, when you
          choose, uploaded references to AI providers to generate or refine outputs. Only information
          reasonably needed for the requested operation is supplied.
        </p>
        <p>
          Avoid submitting secrets or sensitive personal data through prompts or references. AI
          provider handling is also subject to the applicable provider&apos;s contractual and privacy
          terms.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "How information is shared",
    content: (
      <>
        <p>We share information only as needed with service providers that help operate Drawgle, including:</p>
        <LegalList>
          <li><strong>Supabase</strong> for authentication, database, storage, and realtime infrastructure;</li>
          <li><strong>Google Gemini</strong> and other disclosed AI providers for generation and analysis;</li>
          <li><strong>Trigger.dev</strong> for background job orchestration;</li>
          <li><strong>Cloudflare R2</strong> for visual asset storage and delivery;</li>
          <li><strong>Dodo Payments</strong> for checkout, subscriptions, taxes, invoices, and payment processing;</li>
          <li>security, analytics, support, and professional advisers where reasonably necessary.</li>
        </LegalList>
        <p>
          We may also disclose information when required by law, to protect safety or rights, or as
          part of a merger, financing, acquisition, or asset transfer. We do not sell personal data
          for money.
        </p>
      </>
    ),
  },
  {
    id: "public-content",
    title: "Public and shared content",
    content: (
      <p>
        Projects are private unless a feature clearly lets you publish or share them. If you choose
        to publish content, fork a public template, or submit material for a public showcase, the
        associated content and attribution may be visible to others as explained at the time.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Retention and deletion",
    content: (
      <>
        <p>
          We retain account and project data while your account is active and as needed to provide
          the service. We may retain billing records, security logs, backups, and records required
          for legal, tax, fraud-prevention, or dispute-resolution purposes after account deletion.
        </p>
        <p>
          You may delete projects through available product controls. To request account deletion or
          deletion of data not available through the product, contact{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>.
          Deletion from backups and downstream systems may take additional time.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <p>
        We use reasonable technical and organizational safeguards, including authentication,
        access controls, encrypted transport, row-level data controls, and restricted service
        credentials. No system is completely secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your privacy choices and rights",
    content: (
      <>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, restrict, or
          export personal data, or object to certain processing. You may also withdraw consent where
          processing relies on consent.
        </p>
        <p>
          Submit requests to{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>.
          We may need to verify your identity before completing a request.
        </p>
      </>
    ),
  },
  {
    id: "transfers-children",
    title: "International transfers and children",
    content: (
      <>
        <p>
          Drawgle and its providers may process data in countries other than your own. Where
          required, we use appropriate safeguards for international transfers.
        </p>
        <p>
          Drawgle is not directed to children under 13, and we do not knowingly collect personal
          data from children under 13. Users must also meet any higher minimum age required in their
          jurisdiction.
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
          We may update this policy as Drawgle and applicable privacy requirements evolve. The
          effective date at the top shows the latest revision.
        </p>
        <p>
          Contact us at{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>.
          Use of Drawgle is also governed by our <LegalLink href="/terms">Terms of Service</LegalLink>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal / Privacy"
      title="Privacy Policy"
      description="A clear account of what Drawgle processes, why it is needed, and the choices available to you."
      sections={sections}
    />
  );
}
