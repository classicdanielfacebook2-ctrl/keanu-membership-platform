export const euBankTransferCountries = [
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK"
];

export const getBankTransferRegion = (countryCode = "") => {
  const code = String(countryCode || "").trim().toUpperCase();
  if (code === "US") {
    return {
      countryCode: code,
      currency: "usd",
      transferType: "us_bank_transfer",
      stripeOptions: {
        type: "us_bank_transfer"
      }
    };
  }

  if (code === "GB" || code === "UK") {
    return {
      countryCode: "GB",
      currency: "gbp",
      transferType: "gb_bank_transfer",
      stripeOptions: {
        type: "gb_bank_transfer"
      }
    };
  }

  if (euBankTransferCountries.includes(code)) {
    return {
      countryCode: code,
      currency: "eur",
      transferType: "eu_bank_transfer",
      stripeOptions: {
        type: "eu_bank_transfer",
        eu_bank_transfer: {
          country: code
        }
      }
    };
  }

  return null;
};
