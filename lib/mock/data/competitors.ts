export interface SeedCompetitor {
  name: string;
  area: string;
  cuisine: string;
  priceBand: "budget" | "mid-range" | "premium";
  instagramFollowers: number;
  rating: number;
}

/** Fictional restaurants — deliberately not real Panjim establishments, since we generate reviews about them. */
export const SEED_COMPETITORS: SeedCompetitor[] = [
  {
    name: "Maré Alta",
    area: "Fontainhas",
    cuisine: "Goan-Portuguese",
    priceBand: "mid-range",
    instagramFollowers: 11400,
    rating: 4.3,
  },
  {
    name: "Zuari Bay Grill",
    area: "Campal",
    cuisine: "Seafood",
    priceBand: "premium",
    instagramFollowers: 19800,
    rating: 4.5,
  },
  {
    name: "Feni & Fire",
    area: "Miramar",
    cuisine: "Contemporary Goan",
    priceBand: "mid-range",
    instagramFollowers: 8600,
    rating: 4.2,
  },
  {
    name: "Costa Verde Kitchen",
    area: "18th June Road",
    cuisine: "Continental",
    priceBand: "budget",
    instagramFollowers: 3400,
    rating: 3.9,
  },
  {
    name: "Baga Breeze Diner",
    area: "Dona Paula",
    cuisine: "Multi-cuisine",
    priceBand: "premium",
    instagramFollowers: 21500,
    rating: 4.1,
  },
  {
    name: "Tia Rosa's",
    area: "Altinho",
    cuisine: "Cafe",
    priceBand: "mid-range",
    instagramFollowers: 14200,
    rating: 4.6,
  },
  {
    name: "Sal River Kitchen",
    area: "Caranzalem",
    cuisine: "Goan-Seafood",
    priceBand: "budget",
    instagramFollowers: 5900,
    rating: 4.0,
  },
  {
    name: "Chorão Table",
    area: "Santa Cruz",
    cuisine: "Fusion",
    priceBand: "mid-range",
    instagramFollowers: 7300,
    rating: 4.4,
  },
];
