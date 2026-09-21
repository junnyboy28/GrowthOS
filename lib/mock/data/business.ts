export const SEED_BUSINESS = {
  name: "Sussegad Kitchen",
  industry: "restaurant",
  location: "Panjim, Goa",
  monthlyBudget: 30000,
  brandNotes:
    "Contemporary Goan-Portuguese fusion in a converted Fontainhas townhouse. Known for prawn balchão, " +
    "reshad pork ribs, and live acoustic sets on weekend evenings. Draws a mix of tourists and young " +
    "Panjim locals; leans into the unhurried 'sussegad' vibe rather than fine-dining formality.",
} as const;

/** The goal seed.ts attaches to the seeded business so a fresh demo:reset always has one real,
 * clickable "Start run" goal against the business that actually has competitor/review data —
 * not just the archived historical-benchmark placeholder goal (see seed.ts). Also used to
 * prefill the onboarding form, so the two stay in sync. */
export const SEED_GOAL_TEXT = "Increase weekend dinner reservations by 20% over the next 3 months";
