import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Drawgle's policy for subscription cancellations, refund requests, and AI credits.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    content: (
      <>
        <p>
          Drawgle provides immediate access to digital services and AI credits after a successful
          purchase. Because AI generation incurs real processing costs, completed or substantially
          used purchases are generally non-refundable except where required by law or described below.
        </p>
        <p>
          This policy applies to purchases made directly through Drawgle. Dodo Payments processes
          payments, taxes, invoices, and approved refunds on our behalf.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "Subscription cancellation",
    content: (
      <>
        <p>
          You may cancel an active subscription from your account at any time. Cancellation is
          scheduled for the end of the current billing period, and you will retain plan access until
          that period ends. Canceling prevents future renewal charges but does not automatically
          refund the current billing period.
        </p>
      </>
    ),
  },
  {
    id: "eligible",
    title: "When a refund may be approved",
    content: (
      <>
        <p>We may approve a full or partial refund when:</p>
        <LegalList>
          <li>you were charged more than once for the same purchase;</li>
          <li>a charge was unauthorized and promptly reported;</li>
          <li>a confirmed billing error charged the wrong amount or plan;</li>
          <li>a prolonged, verified service failure prevented meaningful use of the paid service;</li>
          <li>applicable consumer law requires a refund.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "not-eligible",
    title: "What is generally not refundable",
    content: (
      <>
        <LegalList>
          <li>AI credits that have already been consumed or generation work that has completed;</li>
          <li>dissatisfaction with a subjective design result after substantial service use;</li>
          <li>unused time caused by forgetting to cancel before renewal;</li>
          <li>changes in your needs, business, device, or third-party software;</li>
          <li>accounts suspended or terminated for violating our Terms of Service;</li>
          <li>currency-conversion differences, bank fees, or taxes not controlled by Drawgle.</li>
        </LegalList>
      </>
    ),
  },
  {
    id: "request",
    title: "How to request a refund",
    content: (
      <>
        <p>
          Email{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>{" "}
          within 14 days of the charge. Include your account email, invoice or payment identifier,
          charge date, and a clear explanation of the issue. Do not send complete card details.
        </p>
        <p>
          Requests submitted later than 14 days may still be reviewed where required by law, but may
          be ineligible. Payment-provider processing limitations may also affect whether and how a
          refund can be returned.
        </p>
      </>
    ),
  },
  {
    id: "review",
    title: "Review and processing",
    content: (
      <>
        <p>
          We may review account usage, credits consumed, generation activity, service incidents, and
          billing records to assess a request. Approved refunds are returned through the original
          payment method where possible. Processing times depend on Dodo Payments, your bank, and
          payment network.
        </p>
        <p>
          If a refund reverses a purchase, associated credits, plan access, or benefits may be
          removed. We may issue a partial refund when part of the paid service was already used.
        </p>
      </>
    ),
  },
  {
    id: "chargebacks",
    title: "Chargebacks and unauthorized payments",
    content: (
      <p>
        Contact us first when possible so we can investigate quickly. Filing a chargeback for a
        legitimate purchase without contacting us may delay resolution and can result in temporary
        account restriction while the dispute is reviewed. This does not limit your rights with your
        bank or under applicable law.
      </p>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    content: (
      <>
        <p>
          We may update this policy for future purchases. The policy in effect when you purchased
          will apply unless applicable law requires otherwise.
        </p>
        <p>
          Questions may be sent to{" "}
          <a className="font-medium text-[#1b7fcc]" href="mailto:support@drawgle.com">support@drawgle.com</a>.
          Also review our <LegalLink href="/terms">Terms of Service</LegalLink>.
        </p>
      </>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal / Refunds"
      title="Refund Policy"
      description="How cancellations, AI-credit usage, billing errors, and refund requests are handled."
      sections={sections}
    />
  );
}
