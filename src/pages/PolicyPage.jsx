const effectiveDate = "Effective May 25, 2026";

const content = {
  terms: {
    eyebrow: "Legal",
    title: "Terms and Conditions",
    intro:
      "These Terms and Conditions govern your access to KR Global Membership digital services, membership accounts, community features, online purchases, and customer support.",
    sections: [
      {
        heading: "Account Registration",
        body:
          "You are responsible for providing accurate registration information, keeping your login credentials confidential, and promptly updating your account details when they change. You are responsible for all activity that occurs under your account."
      },
      {
        heading: "Membership Access",
        body:
          "KR Global Membership offers digital membership access, member communications, community features, and related online services. Membership benefits may vary by card level, availability, location, and eligibility requirements."
      },
      {
        heading: "User Responsibilities",
        body:
          "You agree to use the platform lawfully, respectfully, and only for personal membership purposes. You may not misuse support channels, impersonate another person, submit false information, interfere with platform security, or attempt unauthorized access."
      },
      {
        heading: "Prohibited Activities",
        body:
          "Fraud, chargeback abuse, unauthorized resale, scraping, automated account creation, harassment, intellectual property misuse, payment manipulation, and attempts to bypass account or payment controls are prohibited."
      },
      {
        heading: "Payments",
        body:
          "Prices, taxes, fees, and available payment methods are displayed during checkout. Payments are processed by secure third-party payment providers. By completing a purchase, you authorize the selected payment provider to charge the amount shown."
      },
      {
        heading: "Support and Communications",
        body:
          "You may receive service emails, verification messages, support updates, account notices, payment receipts, and membership communications. You are responsible for ensuring that your contact details remain reachable."
      },
      {
        heading: "Termination Rights",
        body:
          "KR Global Membership may suspend or terminate access if an account violates these Terms, creates security risk, submits fraudulent information, abuses support services, or engages in prohibited activity."
      },
      {
        heading: "Limitation of Liability",
        body:
          "To the fullest extent permitted by law, KR Global Membership is not liable for indirect, incidental, consequential, special, or punitive damages arising from your use of the platform, membership services, or third-party payment systems."
      }
    ]
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro:
      "This Privacy Policy explains how KR Global Membership collects, uses, stores, and protects information connected to accounts, purchases, membership access, and customer support.",
    sections: [
      {
        heading: "Information We Collect",
        body:
          "We may collect your name, email address, phone number, country, account credentials, membership selection, purchase records, support messages, device information, IP address, and fraud-prevention signals."
      },
      {
        heading: "How We Use Information",
        body:
          "We use information to create and secure accounts, provide membership access, process purchases, send verification messages, deliver support, prevent fraud, maintain service records, and improve platform reliability."
      },
      {
        heading: "Cookies and Analytics",
        body:
          "We may use cookies, local storage, and similar technologies to keep you signed in, remember preferences, measure performance, protect sessions, and understand how visitors use the website."
      },
      {
        heading: "Payment Processing",
        body:
          "Payment information is handled by secure payment providers. KR Global Membership does not store full payment card numbers on its own servers. Payment providers may process information under their own privacy and security terms."
      },
      {
        heading: "Secure Storage",
        body:
          "We apply administrative, technical, and organizational safeguards designed to protect account information, support records, and transaction-related data against unauthorized access, alteration, disclosure, or loss."
      },
      {
        heading: "Sharing Information",
        body:
          "We may share limited information with service providers that support hosting, authentication, email delivery, SMS verification, payment processing, customer support, fraud prevention, and legal compliance."
      },
      {
        heading: "Privacy Rights",
        body:
          "Depending on your location, including GDPR or similar privacy laws, you may request access, correction, deletion, restriction, portability, or objection to certain processing of your personal information."
      },
      {
        heading: "Contact",
        body:
          "For privacy questions or data requests, contact KR Global Membership at support@keanureeves.company. We may need to verify your identity before processing certain requests."
      }
    ]
  },
  refund: {
    eyebrow: "Refunds",
    title: "Refund Policy",
    intro:
      "This Refund Policy explains how KR Global Membership handles digital membership purchases, unauthorized payments, duplicate charges, support requests, and approved refund processing.",
    sections: [
      {
        heading: "Digital Memberships",
        body:
          "Digital memberships are generally non-refundable once activated, accessed, or used because access to member services and digital benefits begins immediately after activation."
      },
      {
        heading: "Duplicate or Unauthorized Payments",
        body:
          "Duplicate charges, suspected unauthorized payments, billing errors, or payment disputes may be submitted to support for assessment. We may request transaction details, receipts, account information, and identity verification."
      },
      {
        heading: "How to Request Support",
        body:
          "Contact support@keanureeves.company with your full name, account email, transaction reference, payment method, purchase date, and a clear description of the issue."
      },
      {
        heading: "Refund Decisions",
        body:
          "Approved refunds are issued to the original payment method whenever possible. Eligibility depends on membership activation status, transaction records, payment provider rules, fraud indicators, and applicable law."
      },
      {
        heading: "Processing Time",
        body:
          "Approved refunds are typically submitted within 5 to 10 business days. Your bank, card issuer, or payment provider may require additional time to post the funds to your account."
      },
      {
        heading: "Chargebacks",
        body:
          "If you believe a payment was made in error, contact support before opening a dispute. Chargeback abuse, false claims, or manipulated evidence may result in account restrictions."
      }
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
        <p className="policy-date">{effectiveDate}</p>
        <p className="policy-intro">{page.intro}</p>
        <div className="policy-list">
          {page.sections.map((section, index) => (
            <article key={section.heading}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
