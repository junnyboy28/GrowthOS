export interface AudienceSegment {
  name: string;
  description: string;
  characteristics: string[];
}

/**
 * Reference content used to flavor seeded campaign audiences and search
 * fixtures. Not a persisted table — ARCHITECTURE.md's schema doesn't define
 * one, and no stage currently reads segments from the DB.
 */
export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  {
    name: "Weekend domestic tourists",
    description:
      "Short-trip visitors from other Indian cities looking for an 'authentic' Goan night out with good ambience.",
    characteristics: ["age 25-40", "2-4 day trips", "Instagram-driven", "moderately price-insensitive"],
  },
  {
    name: "Backpacker travellers",
    description:
      "Longer-stay foreign and domestic travellers seeking local flavour, good reviews, and value.",
    characteristics: ["age 20-35", "1-4 week stays", "TripAdvisor/Google reviews driven", "budget-conscious"],
  },
  {
    name: "Young Panjim professionals",
    description:
      "Local working professionals for after-work drinks and weekend brunch; responsive to offers and happy-hour deals.",
    characteristics: ["age 22-35", "lives/works in Panjim", "weekday evenings + weekend brunch", "offer-responsive"],
  },
  {
    name: "Local families",
    description:
      "Panjim-area families choosing a relaxed Sunday lunch or celebration dinner; need kid-friendly seating and menu.",
    characteristics: ["age 30-55", "groups of 4-8", "Sunday lunch", "price-sensitive on weekdays"],
  },
  {
    name: "Corporate lunch crowd",
    description:
      "Office workers from nearby Patto/Campal business areas wanting a quick, good-value weekday lunch.",
    characteristics: ["age 25-45", "weekday 12-2pm", "quick service", "value combo meals"],
  },
  {
    name: "Live-music & nightlife seekers",
    description:
      "Locals and tourists coming specifically for weekend acoustic sets, with higher average spend on food and drinks.",
    characteristics: ["age 22-40", "Fri-Sun evenings", "higher ticket size", "drinks-led"],
  },
];
