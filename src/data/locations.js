export const locationCountries = [
  {
    id: "US",
    name: "United States",
    regions: [
      { name: "California", cities: ["Los Angeles", "San Francisco", "San Diego", "Sacramento"] },
      { name: "New York", cities: ["New York City", "Buffalo", "Albany", "Rochester"] },
      { name: "Florida", cities: ["Miami", "Orlando", "Tampa", "Jacksonville"] },
      { name: "Texas", cities: ["Houston", "Dallas", "Austin", "San Antonio"] }
    ]
  },
  {
    id: "CA",
    name: "Canada",
    regions: [
      { name: "Ontario", cities: ["Toronto", "Ottawa", "Mississauga", "Hamilton"] },
      { name: "British Columbia", cities: ["Vancouver", "Victoria", "Kelowna", "Burnaby"] },
      { name: "Quebec", cities: ["Montreal", "Quebec City", "Laval", "Gatineau"] }
    ]
  },
  {
    id: "GB",
    name: "United Kingdom",
    regions: [
      { name: "England", cities: ["London", "Manchester", "Birmingham", "Liverpool"] },
      { name: "Scotland", cities: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"] },
      { name: "Wales", cities: ["Cardiff", "Swansea", "Newport", "Bangor"] }
    ]
  },
  {
    id: "DE",
    name: "Germany",
    regions: [
      { name: "Berlin", cities: ["Berlin"] },
      { name: "Bavaria", cities: ["Munich", "Nuremberg", "Augsburg", "Regensburg"] },
      { name: "North Rhine-Westphalia", cities: ["Cologne", "Dusseldorf", "Dortmund", "Essen"] }
    ]
  },
  {
    id: "FR",
    name: "France",
    regions: [
      { name: "Ile-de-France", cities: ["Paris", "Versailles", "Boulogne-Billancourt"] },
      { name: "Provence-Alpes-Cote d'Azur", cities: ["Marseille", "Nice", "Cannes", "Aix-en-Provence"] },
      { name: "Auvergne-Rhone-Alpes", cities: ["Lyon", "Grenoble", "Saint-Etienne"] }
    ]
  },
  {
    id: "IT",
    name: "Italy",
    regions: [
      { name: "Lazio", cities: ["Rome", "Latina", "Viterbo"] },
      { name: "Lombardy", cities: ["Milan", "Bergamo", "Como", "Brescia"] },
      { name: "Tuscany", cities: ["Florence", "Pisa", "Siena", "Lucca"] }
    ]
  },
  {
    id: "ES",
    name: "Spain",
    regions: [
      { name: "Madrid", cities: ["Madrid", "Alcala de Henares", "Getafe"] },
      { name: "Catalonia", cities: ["Barcelona", "Girona", "Tarragona"] },
      { name: "Andalusia", cities: ["Seville", "Malaga", "Granada", "Cordoba"] }
    ]
  },
  {
    id: "NL",
    name: "Netherlands",
    regions: [
      { name: "North Holland", cities: ["Amsterdam", "Haarlem", "Alkmaar"] },
      { name: "South Holland", cities: ["Rotterdam", "The Hague", "Leiden"] },
      { name: "Utrecht", cities: ["Utrecht", "Amersfoort", "Zeist"] }
    ]
  },
  {
    id: "AU",
    name: "Australia",
    regions: [
      { name: "New South Wales", cities: ["Sydney", "Newcastle", "Wollongong"] },
      { name: "Victoria", cities: ["Melbourne", "Geelong", "Ballarat"] },
      { name: "Queensland", cities: ["Brisbane", "Gold Coast", "Cairns"] }
    ]
  },
  {
    id: "NG",
    name: "Nigeria",
    regions: [
      { name: "Lagos", cities: ["Lagos", "Ikeja", "Lekki", "Victoria Island"] },
      { name: "Federal Capital Territory", cities: ["Abuja", "Gwarinpa", "Maitama"] },
      { name: "Rivers", cities: ["Port Harcourt", "Bonny", "Obio-Akpor"] }
    ]
  },
  {
    id: "GH",
    name: "Ghana",
    regions: [
      { name: "Greater Accra", cities: ["Accra", "Tema", "Madina"] },
      { name: "Ashanti", cities: ["Kumasi", "Obuasi", "Ejisu"] },
      { name: "Western", cities: ["Takoradi", "Sekondi", "Tarkwa"] }
    ]
  },
  {
    id: "ZA",
    name: "South Africa",
    regions: [
      { name: "Gauteng", cities: ["Johannesburg", "Pretoria", "Sandton"] },
      { name: "Western Cape", cities: ["Cape Town", "Stellenbosch", "George"] },
      { name: "KwaZulu-Natal", cities: ["Durban", "Pietermaritzburg", "Umhlanga"] }
    ]
  },
  {
    id: "MA",
    name: "Morocco",
    regions: [
      { name: "Casablanca-Settat", cities: ["Casablanca", "Mohammedia", "El Jadida"] },
      { name: "Rabat-Sale-Kenitra", cities: ["Rabat", "Sale", "Kenitra"] },
      { name: "Marrakesh-Safi", cities: ["Marrakesh", "Safi", "Essaouira"] }
    ]
  },
  {
    id: "TN",
    name: "Tunisia",
    regions: [
      { name: "Tunis", cities: ["Tunis", "La Marsa", "Carthage"] },
      { name: "Sousse", cities: ["Sousse", "Msaken", "Hammam Sousse"] },
      { name: "Sfax", cities: ["Sfax", "Sakiet Ezzit", "Thyna"] }
    ]
  },
  {
    id: "AE",
    name: "United Arab Emirates",
    regions: [
      { name: "Dubai", cities: ["Dubai", "Jumeirah", "Downtown Dubai"] },
      { name: "Abu Dhabi", cities: ["Abu Dhabi", "Al Ain", "Mussafah"] },
      { name: "Sharjah", cities: ["Sharjah", "Khor Fakkan", "Kalba"] }
    ]
  },
  {
    id: "JP",
    name: "Japan",
    regions: [
      { name: "Tokyo", cities: ["Tokyo", "Shibuya", "Shinjuku"] },
      { name: "Osaka", cities: ["Osaka", "Sakai", "Higashiosaka"] },
      { name: "Kyoto", cities: ["Kyoto", "Uji", "Kameoka"] }
    ]
  },
  {
    id: "BR",
    name: "Brazil",
    regions: [
      { name: "Sao Paulo", cities: ["Sao Paulo", "Campinas", "Santos"] },
      { name: "Rio de Janeiro", cities: ["Rio de Janeiro", "Niteroi", "Petropolis"] },
      { name: "Bahia", cities: ["Salvador", "Feira de Santana", "Ilheus"] }
    ]
  }
];

export const getCountryByName = (name) => locationCountries.find((country) => country.name === name);

export const getRegionByName = (countryName, regionName) =>
  getCountryByName(countryName)?.regions.find((region) => region.name === regionName);
