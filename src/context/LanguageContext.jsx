import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGE_STORAGE_KEY = "kr-auth-language";

const dictionaries = {
  en: {
    language: {
      label: "Language",
      english: "English",
      german: "Deutsch"
    },
    nav: {
      loading: "Loading page",
      mainNavigation: "Main navigation",
      home: "Home",
      journey: "Journey",
      apply: "Apply",
      support: "Support",
      protection: "Protection",
      admin: "Admin",
      payments: "Payments",
      supportDesk: "Support Desk",
      media: "Media",
      account: "My Account",
      logout: "Logout",
      login: "Login",
      closeNavigation: "Close navigation",
      toggleNavigation: "Toggle navigation"
    },
    footer: {
      company: "Keanu Reeves Company",
      copyright: "Copyright 2026. All rights reserved.",
      terms: "Terms",
      privacy: "Privacy",
      refund: "Refund Policy",
      security: "Security Policy",
      social: "Social media links"
    },
    contact: {
      title: "Contact us directly",
      subtext: "Message support on WhatsApp or Telegram",
      channels: "Direct support channels",
      whatsappAria: "Message support on WhatsApp",
      telegramAria: "Message support on Telegram",
      whatsappMessage: "Hello support, I need help with my membership application."
    },
    welcome: {
      aria: "Official website welcome",
      kicker: "WELCOME TO THE OFFICIAL WEBSITE",
      title: "KEANU REEVES",
      subtitle: "A premium membership experience for dedicated supporters worldwide.",
      enter: "ENTER OFFICIAL PLATFORM"
    },
    home: {
      videoReady: "Video ready",
      tapForSound: "Tap for Sound",
      unavailable: "Media currently unavailable",
      heroEyebrow: "A Premium Membership Experience",
      heroTitle: "More than a card. A connection to a story that continues to inspire.",
      heroCopy:
        "Behind every membership card is a sense of loyalty, recognition, and connection to a legacy shaped by discipline, resilience, and worldwide admiration.",
      discoverMore: "Discover More",
      contactTitle: "Contact Us",
      contactSubtext: "Message support directly on WhatsApp or Telegram",
      applicationEyebrow: "Application Ready",
      applicationTitle: "Begin your membership application",
      applicationCopy: "Choose your membership level and continue through a secure guided application experience.",
      encryptedSession: "Encrypted session",
      privateAccess: "Private account access",
      applyButton: "Apply for Membership",
      featuredEyebrow: "Featured Story",
      featuredTitle: "A cinematic path through career, character, and cultural impact.",
      featuredCopy:
        "A quieter documentary-style sequence, moving through defining roles, visual moments, and the admiration behind the membership experience.",
      visualStory: "Visual Story",
      defaultVideoCopy: "A cinematic media moment prepared for premium membership presentation.",
      advert: {
        "top-video-advert-downloaded": {
          category: "Top Video Advert",
          copy: "A cinematic introduction to the membership experience, designed for supporters who value recognition, story, and access."
        },
        "main-video-banner-downloaded": {
          category: "Cinematic Membership Film",
          copy: "A closer look at the card journey, from selection to secure checkout and account access."
        },
        "interview-preview-downloaded": {
          category: "Interview Feature",
          copy: "Selected media moments that bring a quieter, more personal tone to the platform."
        },
        "membership-campaign-preview-downloaded": {
          category: "Membership Campaign Film",
          copy: "A refined view of the membership tiers and the premium experience behind each card."
        }
      },
      photos: {
        "official-portrait": {
          title: "Official Portrait",
          caption: "A polished portrait moment that sets the tone for a premium membership identity."
        },
        "campaign-still": {
          title: "Campaign Still",
          caption: "A cinematic still that supports the visual world of the membership platform."
        },
        "membership-lifestyle": {
          title: "Membership Card Lifestyle",
          caption: "A lifestyle frame shaped around card ownership, belonging, and private access."
        },
        "press-photo": {
          title: "Press Photo",
          caption: "A refined public-facing image for trust, recognition, and professional presence."
        }
      }
    },
    apply: {
      pageEyebrow: "KR Global Membership",
      pageTitle: "Select your private membership access.",
      pageCopy: "Choose a membership level, complete your details, review your request, then continue to secure checkout.",
      step: "Step",
      of: "of",
      steps: ["Membership", "Application", "Review", "Payment Method"],
      completePrevious: "Complete the previous step before continuing.",
      selectCardError: "Select a membership card to begin.",
      preparingSession: "Preparing your membership session. Please try again in a moment.",
      completeDetails: "Complete the required applicant details before continuing.",
      selectPayment: "Select a payment method before continuing to secure checkout.",
      unavailableTitle: "Payment method unavailable",
      unavailableBody: "This payment method is currently unavailable. Please choose another payment method.",
      checkoutUnavailableTitle: "Checkout unavailable",
      checkoutUnavailableBody: "This payment method is currently unavailable. Please choose another payment method.",
      notProvided: "Not provided",
      popular: "Most Popular",
      membershipKicker: "KR Global Membership",
      perPerson: "/person",
      formEyebrow: "Membership details",
      formTitle: "Complete Your Membership Application",
      formCopy: "Provide your details so we can review and prepare your selected membership.",
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone number",
      selectedCard: "Selected membership card",
      country: "Country",
      state: "State / Region",
      city: "City",
      manualState: "Type state / region manually",
      manualCity: "Type city manually",
      applicants: "Number of applicants",
      message: "Message or special request",
      firstNamePlaceholder: "Enter first name",
      lastNamePlaceholder: "Enter last name",
      selectCountry: "Select country",
      selectState: "Select state or region",
      selectCountryFirst: "Select country first",
      selectCity: "Select city",
      selectStateFirst: "Select state or region first",
      manualStatePlaceholder: "Enter your state or region",
      manualCityPlaceholder: "Enter your city",
      messagePlaceholder: "Share any request or detail you would like us to consider.",
      reviewEyebrow: "Application Review",
      reviewTitle: "Review Your Application",
      reviewCopy: "Please confirm your details before secure payment.",
      selectedMembership: "Selected membership",
      readyForPayment: "Ready for payment",
      applicantDetails: "Applicant details",
      fullName: "Full name",
      location: "Location",
      membership: "Membership",
      numberApplicants: "Number of applicants",
      totalAmount: "Total amount",
      paymentEyebrow: "Payment Method",
      paymentTitle: "Choose Payment Method",
      paymentCopy: "Select how you would like to continue. Stripe Checkout securely collects all payment details on the next screen.",
      checkingPayments: "Checking available payment methods...",
      secureCheckout: "Secure encrypted checkout. Payment details are collected only by Stripe after you continue.",
      back: "Back",
      continue: "Continue",
      submit: "Submit Application",
      choosePayment: "Choose Payment Method",
      openingCheckout: "Opening checkout...",
      secureCheckoutButton: "Continue to Secure Checkout",
      paymentRequired: "Select a payment method to continue.",
      whyEyebrow: "The Membership Experience",
      whyTitle: "More Than a Card. A Private Membership Experience.",
      whyCopy:
        "This membership is designed for dedicated supporters who want a more personal, premium, and recognized connection to the official platform. Each card represents access, identity, priority support, and a place within an exclusive digital membership community.",
      features: [
        ["01", "Official Recognition", "Your membership card gives you a unique member identity and confirms your place within the official membership platform."],
        ["02", "Premium Digital Access", "Receive access to a refined digital membership experience created for serious supporters worldwide."],
        ["03", "Priority Support", "Members receive guided assistance, account support, and faster responses through the official support channel."],
        ["04", "Exclusive Updates", "Stay connected with selected membership updates, announcements, and platform information before the general public."],
        ["05", "Member Identity", "Each membership includes a unique reference/member ID, helping identify your selected access level clearly and professionally."],
        ["06", "Limited Membership Access", "Membership availability may be limited by tier, review status, and platform approval. Choose your card while access is available."]
      ],
      cards: {
        silver: ["Silver Card", ["Official membership registration", "Member ID number", "Email support", "Community updates"]],
        gold: ["Gold Card", ["Everything in Silver", "Priority support", "Digital certificate", "Special announcements"]],
        vip: ["VIP Card", ["Everything in Gold", "VIP badge", "Faster application processing", "Exclusive member updates"]],
        premium: ["Premium Card", ["Everything in VIP", "Premium recognition", "Priority email and live chat support", "Special access offers for eligible members"]]
      },
      paymentMethods: {
        card: ["Card / Wallets", "Pay securely by card, Apple Pay, Google Pay, or Link when available."],
        sepa: ["SEPA Direct Debit", "Pay from a supported European bank account. Confirmation may take longer."],
        bank_transfer: ["Bank Transfer", "Continue to secure hosted checkout for bank transfer instructions."],
        ideal: ["iDEAL / Local bank payment", "Use a supported local bank payment method through secure checkout."]
      }
    }
  },
  de: {
    language: {
      label: "Sprache",
      english: "English",
      german: "Deutsch"
    },
    nav: {
      loading: "Seite wird geladen",
      mainNavigation: "Hauptnavigation",
      home: "Startseite",
      journey: "Geschichte",
      apply: "Bewerben",
      support: "Support",
      protection: "Schutz",
      admin: "Admin",
      payments: "Zahlungen",
      supportDesk: "Support Desk",
      media: "Medien",
      account: "Mein Konto",
      logout: "Abmelden",
      login: "Anmelden",
      closeNavigation: "Navigation schließen",
      toggleNavigation: "Navigation öffnen"
    },
    footer: {
      company: "Keanu Reeves Company",
      copyright: "Copyright 2026. Alle Rechte vorbehalten.",
      terms: "Bedingungen",
      privacy: "Datenschutz",
      refund: "Rückerstattungsrichtlinie",
      security: "Sicherheitsrichtlinie",
      social: "Social-Media-Links"
    },
    contact: {
      title: "Direkt Kontakt aufnehmen",
      subtext: "Schreiben Sie dem Support über WhatsApp oder Telegram",
      channels: "Direkte Supportkanäle",
      whatsappAria: "Support über WhatsApp kontaktieren",
      telegramAria: "Support über Telegram kontaktieren",
      whatsappMessage: "Hallo Support, ich brauche Hilfe mit meiner Mitgliedschaftsbewerbung."
    },
    welcome: {
      aria: "Willkommen auf der offiziellen Website",
      kicker: "WILLKOMMEN AUF DER OFFIZIELLEN WEBSITE",
      title: "KEANU REEVES",
      subtitle: "Ein Premium-Mitgliedschaftserlebnis für engagierte Unterstützer weltweit.",
      enter: "OFFIZIELLE PLATTFORM BETRETEN"
    },
    home: {
      videoReady: "Video bereit",
      tapForSound: "Für Ton tippen",
      unavailable: "Medien derzeit nicht verfügbar",
      heroEyebrow: "Ein Premium-Mitgliedschaftserlebnis",
      heroTitle: "Mehr als eine Karte. Eine Verbindung zu einer Geschichte, die weiter inspiriert.",
      heroCopy:
        "Hinter jeder Mitgliedskarte steht ein Gefühl von Loyalität, Anerkennung und Verbindung zu einem Vermächtnis, das von Disziplin, Widerstandskraft und weltweiter Bewunderung geprägt ist.",
      discoverMore: "Mehr entdecken",
      contactTitle: "Kontakt",
      contactSubtext: "Schreiben Sie dem Support direkt über WhatsApp oder Telegram",
      applicationEyebrow: "Bewerbung bereit",
      applicationTitle: "Beginnen Sie Ihre Mitgliedschaftsbewerbung",
      applicationCopy: "Wählen Sie Ihre Mitgliedschaftsstufe und folgen Sie einem sicheren, geführten Bewerbungsprozess.",
      encryptedSession: "Verschlüsselte Sitzung",
      privateAccess: "Privater Kontozugang",
      applyButton: "Mitgliedschaft beantragen",
      featuredEyebrow: "Ausgewählte Geschichte",
      featuredTitle: "Ein filmischer Weg durch Karriere, Charakter und kulturelle Wirkung.",
      featuredCopy:
        "Eine ruhigere dokumentarische Sequenz über prägende Rollen, visuelle Momente und die Wertschätzung hinter dem Mitgliedschaftserlebnis.",
      visualStory: "Visuelle Geschichte",
      defaultVideoCopy: "Ein filmischer Medienmoment, vorbereitet für eine hochwertige Mitgliedschaftspräsentation.",
      advert: {
        "top-video-advert-downloaded": {
          category: "Top-Videoanzeige",
          copy: "Eine filmische Einführung in das Mitgliedschaftserlebnis, geschaffen für Unterstützer, die Anerkennung, Geschichte und Zugang schätzen."
        },
        "main-video-banner-downloaded": {
          category: "Film zur Mitgliedschaft",
          copy: "Ein näherer Blick auf den Weg der Karte, von der Auswahl bis zum sicheren Checkout und Kontozugang."
        },
        "interview-preview-downloaded": {
          category: "Interview-Feature",
          copy: "Ausgewählte Medienmomente, die der Plattform einen ruhigeren und persönlicheren Ton geben."
        },
        "membership-campaign-preview-downloaded": {
          category: "Mitgliedschaftskampagne",
          copy: "Ein verfeinerter Blick auf die Mitgliedschaftsstufen und das Premium-Erlebnis hinter jeder Karte."
        }
      },
      photos: {
        "official-portrait": {
          title: "Offizielles Porträt",
          caption: "Ein eleganter Porträtmoment, der den Ton für eine hochwertige Mitgliedsidentität setzt."
        },
        "campaign-still": {
          title: "Kampagnenbild",
          caption: "Ein filmisches Standbild, das die visuelle Welt der Mitgliedschaftsplattform unterstützt."
        },
        "membership-lifestyle": {
          title: "Mitgliedschafts-Lifestyle",
          caption: "Ein Lifestyle-Bild rund um Kartenbesitz, Zugehörigkeit und privaten Zugang."
        },
        "press-photo": {
          title: "Pressefoto",
          caption: "Ein professionelles öffentliches Bild für Vertrauen, Wiedererkennung und seriöse Präsentation."
        }
      }
    },
    apply: {
      pageEyebrow: "KR Global Membership",
      pageTitle: "Wählen Sie Ihren privaten Mitgliedszugang.",
      pageCopy: "Wählen Sie eine Mitgliedschaftsstufe, füllen Sie Ihre Angaben aus, prüfen Sie Ihre Anfrage und fahren Sie dann mit dem sicheren Checkout fort.",
      step: "Schritt",
      of: "von",
      steps: ["Mitgliedschaft", "Bewerbung", "Prüfung", "Zahlungsmethode"],
      completePrevious: "Schließen Sie den vorherigen Schritt ab, bevor Sie fortfahren.",
      selectCardError: "Wählen Sie eine Mitgliedskarte, um zu beginnen.",
      preparingSession: "Ihre Mitgliedschaftssitzung wird vorbereitet. Bitte versuchen Sie es gleich erneut.",
      completeDetails: "Füllen Sie die erforderlichen Bewerberdaten aus, bevor Sie fortfahren.",
      selectPayment: "Wählen Sie eine Zahlungsmethode, bevor Sie zum sicheren Checkout fortfahren.",
      unavailableTitle: "Zahlungsmethode nicht verfügbar",
      unavailableBody: "Diese Zahlungsmethode ist derzeit nicht verfügbar. Bitte wählen Sie eine andere Zahlungsmethode.",
      checkoutUnavailableTitle: "Checkout nicht verfügbar",
      checkoutUnavailableBody: "Diese Zahlungsmethode ist derzeit nicht verfügbar. Bitte wählen Sie eine andere Zahlungsmethode.",
      notProvided: "Nicht angegeben",
      popular: "Am beliebtesten",
      membershipKicker: "KR Global Membership",
      perPerson: "/Person",
      formEyebrow: "Mitgliedschaftsdaten",
      formTitle: "Mitgliedschaftsbewerbung ausfüllen",
      formCopy: "Geben Sie Ihre Daten an, damit wir Ihre ausgewählte Mitgliedschaft vorbereiten können.",
      firstName: "Vorname",
      lastName: "Nachname",
      email: "E-Mail",
      phone: "Telefonnummer",
      selectedCard: "Ausgewählte Mitgliedskarte",
      country: "Land",
      state: "Bundesland / Region",
      city: "Stadt",
      manualState: "Bundesland / Region manuell eingeben",
      manualCity: "Stadt manuell eingeben",
      applicants: "Anzahl der Bewerber",
      message: "Nachricht oder Sonderwunsch",
      firstNamePlaceholder: "Vorname eingeben",
      lastNamePlaceholder: "Nachname eingeben",
      selectCountry: "Land auswählen",
      selectState: "Bundesland oder Region auswählen",
      selectCountryFirst: "Zuerst Land auswählen",
      selectCity: "Stadt auswählen",
      selectStateFirst: "Zuerst Bundesland oder Region auswählen",
      manualStatePlaceholder: "Bundesland oder Region eingeben",
      manualCityPlaceholder: "Stadt eingeben",
      messagePlaceholder: "Teilen Sie uns einen Wunsch oder ein Detail mit, das berücksichtigt werden soll.",
      reviewEyebrow: "Bewerbungsprüfung",
      reviewTitle: "Bewerbung prüfen",
      reviewCopy: "Bitte bestätigen Sie Ihre Angaben vor der sicheren Zahlung.",
      selectedMembership: "Ausgewählte Mitgliedschaft",
      readyForPayment: "Bereit zur Zahlung",
      applicantDetails: "Bewerberdaten",
      fullName: "Vollständiger Name",
      location: "Standort",
      membership: "Mitgliedschaft",
      numberApplicants: "Anzahl der Bewerber",
      totalAmount: "Gesamtbetrag",
      paymentEyebrow: "Zahlungsmethode",
      paymentTitle: "Zahlungsmethode wählen",
      paymentCopy: "Wählen Sie, wie Sie fortfahren möchten. Stripe Checkout erfasst alle Zahlungsdaten sicher auf dem nächsten Bildschirm.",
      checkingPayments: "Verfügbare Zahlungsmethoden werden geprüft...",
      secureCheckout: "Sicherer verschlüsselter Checkout. Zahlungsdaten werden erst nach dem Fortfahren von Stripe erfasst.",
      back: "Zurück",
      continue: "Weiter",
      submit: "Bewerbung absenden",
      choosePayment: "Zahlungsmethode wählen",
      openingCheckout: "Checkout wird geöffnet...",
      secureCheckoutButton: "Weiter zum sicheren Checkout",
      paymentRequired: "Wählen Sie eine Zahlungsmethode, um fortzufahren.",
      whyEyebrow: "Das Mitgliedschaftserlebnis",
      whyTitle: "Mehr als eine Karte. Ein privates Mitgliedschaftserlebnis.",
      whyCopy:
        "Diese Mitgliedschaft richtet sich an engagierte Unterstützer, die eine persönlichere, hochwertigere und anerkannte Verbindung zur offiziellen Plattform wünschen. Jede Karte steht für Zugang, Identität, priorisierten Support und einen Platz innerhalb einer exklusiven digitalen Mitgliedschaftsgemeinschaft.",
      features: [
        ["01", "Offizielle Anerkennung", "Ihre Mitgliedskarte gibt Ihnen eine eindeutige Mitgliedsidentität und bestätigt Ihren Platz auf der offiziellen Mitgliedschaftsplattform."],
        ["02", "Premium-Digitalzugang", "Erhalten Sie Zugang zu einem verfeinerten digitalen Mitgliedschaftserlebnis für ernsthafte Unterstützer weltweit."],
        ["03", "Priorisierter Support", "Mitglieder erhalten geführte Unterstützung, Kontosupport und schnellere Antworten über den offiziellen Supportkanal."],
        ["04", "Exklusive Updates", "Bleiben Sie mit ausgewählten Mitgliedschaftsupdates, Ankündigungen und Plattforminformationen vor der Öffentlichkeit verbunden."],
        ["05", "Mitgliedsidentität", "Jede Mitgliedschaft enthält eine eindeutige Referenz- oder Mitglieds-ID, damit Ihre Zugangsstufe klar und professionell erkennbar ist."],
        ["06", "Begrenzter Zugang", "Die Verfügbarkeit kann je nach Stufe, Status und Plattformfreigabe begrenzt sein. Wählen Sie Ihre Karte, solange Zugang verfügbar ist."]
      ],
      cards: {
        silver: ["Silber-Karte", ["Offizielle Mitgliedschaftsregistrierung", "Mitglieds-ID-Nummer", "E-Mail-Support", "Community-Updates"]],
        gold: ["Gold-Karte", ["Alles aus Silber", "Priorisierter Support", "Digitales Zertifikat", "Besondere Ankündigungen"]],
        vip: ["VIP-Karte", ["Alles aus Gold", "VIP-Abzeichen", "Schnellere Bearbeitung der Bewerbung", "Exklusive Mitglieder-Updates"]],
        premium: ["Premium-Karte", ["Alles aus VIP", "Premium-Anerkennung", "Priorisierter E-Mail- und Live-Chat-Support", "Besondere Zugangsangebote für berechtigte Mitglieder"]]
      },
      paymentMethods: {
        card: ["Karte / Wallets", "Zahlen Sie sicher per Karte, Apple Pay, Google Pay oder Link, sofern verfügbar."],
        sepa: ["SEPA-Lastschrift", "Zahlen Sie von einem unterstützten europäischen Bankkonto. Die Bestätigung kann länger dauern."],
        bank_transfer: ["Banküberweisung", "Fahren Sie zum sicheren gehosteten Checkout fort, um Überweisungsanweisungen zu erhalten."],
        ideal: ["iDEAL / lokale Bankzahlung", "Nutzen Sie eine unterstützte lokale Bankzahlung über den sicheren Checkout."],
      }
    }
  }
};

const readStoredLanguage = () => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
  } catch {
    return "en";
  }
};

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: dictionaries.en
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  const setLanguage = (nextLanguage) => {
    const safeLanguage = dictionaries[nextLanguage] ? nextLanguage : "en";
    setLanguageState(safeLanguage);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, safeLanguage);
    } catch {
      // Preference storage is optional.
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === "de" ? "de" : "en";
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: dictionaries[language] || dictionaries.en
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
