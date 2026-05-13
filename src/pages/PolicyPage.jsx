const content = {
  terms: {
    eyebrow: "Terms",
    title: "Terms and Conditions",
    intro: "These terms describe the intended operating rules for this pre-launch review platform.",
    body: [
      "This website is a management review version and is not yet a public production service.",
      "Membership card approval, pricing, benefits, availability, identity checks, and delivery rules must be confirmed by authorized management before launch.",
      "Applicants should receive final official terms before any live payment or membership commitment is accepted.",
      "The platform must connect to secure backend services, admin authentication, and approved payment providers before publication."
    ]
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro: "This page explains how applicant information should be handled in the review and production versions.",
    body: [
      "This demo stores submitted applications and support messages in the browser using localStorage for review only.",
      "Production data should be stored on secure servers with role-based access, encryption, document retention rules, and audit logs.",
      "Payment card details must not be collected manually. Live payment data should be handled only by an approved secure payment provider.",
      "Only information necessary for application review, support, and fulfillment should be requested from applicants."
    ]
  },
  refund: {
    eyebrow: "Refunds",
    title: "Refund Policy",
    intro: "Refund terms are placeholders until management approves final commercial rules.",
    body: [
      "No real payments are processed in this review version.",
      "Before launch, management should define eligibility rules, processing windows, declined application handling, and support escalation procedures.",
      "Approved payment providers should support receipts, refunds, disputes, and transaction reconciliation.",
      "Applicants must be shown the final refund policy before any live checkout session is created."
    ]
  }
};

export default function PolicyPage({ type }) {
  const page = content[type] || content.terms;

  return (
    <section className="page-section narrow-page legal-page">
      <div className="policy-panel premium-panel">
        <span className="eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p className="policy-intro">{page.intro}</p>
        <div className="policy-list">
          {page.body.map((paragraph, index) => (
            <article key={paragraph}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{paragraph}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
