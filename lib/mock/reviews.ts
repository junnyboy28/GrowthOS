import type { Rng } from "./rng";

const FIRST_NAMES = [
  "Priya", "Rohan", "Aditi", "Vikram", "Sneha", "Arjun", "Meera", "Karan",
  "Nisha", "Rahul", "Ananya", "Siddharth", "Priyanka", "Rajesh", "Divya",
  "Tom", "Emma", "Lucas", "Sofia", "Hans", "Marta", "Chen", "Yuki", "Fatima",
  "Omar", "Liam", "Grace", "Daniel", "Ines", "Noah",
] as const;

const LAST_INITIALS = ["S.", "P.", "M.", "R.", "D.", "K.", "T.", "N.", "", "", "V.", "B."] as const;

const DISHES = [
  "prawn balchão", "sorpotel", "bebinca", "king fish curry", "cafreal chicken",
  "xacuti", "feni sour", "sausage pao", "prawn caldeirada", "pork vindaloo",
  "chorizo pulao", "solkadi",
] as const;

type Template = (subjectName: string, dish: string) => string;

const POSITIVE_TEMPLATES: Template[] = [
  (name, dish) => `${dish} at ${name} was absolutely worth the trip — best I've had in Goa this season.`,
  (name, dish) => `Loved the sussegad vibe at ${name}. The ${dish} hit the spot and the staff were lovely.`,
  (name, dish) => `${name} nailed it. Great value, cosy seating, and the ${dish} is a must-order.`,
  (name, dish) => `Went for the weekend live music and stayed for the ${dish}. ${name} is now a regular stop for us.`,
  (name, dish) => `Friendly service and a lovely sunset view made ${name} one of our best meals in Panjim. ${dish} was excellent.`,
  (name, dish) => `Third visit to ${name} this trip — the ${dish} keeps getting better. Highly recommend.`,
];

const MIXED_TEMPLATES: Template[] = [
  (name, dish) => `${name} is decent — the ${dish} was good but service was a bit slow on a busy Saturday.`,
  (name, dish) => `Average experience at ${name}. ${dish} was fine, nothing that stood out though.`,
  (name, dish) => `${dish} at ${name} was tasty but portions felt small for the price.`,
  (name, dish) => `Nice ambience at ${name}, though we waited almost 30 minutes for the ${dish}.`,
];

const NEGATIVE_TEMPLATES: Template[] = [
  (name, dish) => `Disappointed with ${name} this time — the ${dish} was overpriced for what we got.`,
  (name, dish) => `Service at ${name} needs work. Waited over 40 minutes and the ${dish} came out cold.`,
  (name, dish) => `Not worth the hype. ${dish} at ${name} was average and the place was too noisy to enjoy it.`,
];

export interface GeneratedReview {
  author: string;
  rating: number;
  text: string;
  createdAt: Date;
}

function pickRating(rng: Rng): number {
  const r = rng.next();
  if (r < 0.03) return 1;
  if (r < 0.1) return 2;
  if (r < 0.28) return 3;
  if (r < 0.62) return 4;
  return 5;
}

function randomPastDate(rng: Rng, daysBack: number): Date {
  const offsetDays = rng.int(0, daysBack);
  return new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
}

export function generateReview(rng: Rng, subjectName: string): GeneratedReview {
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_INITIALS);
  const author = last ? `${first} ${last}` : first;
  const rating = pickRating(rng);
  const dish = rng.pick(DISHES);

  const templates =
    rating >= 4 ? POSITIVE_TEMPLATES : rating === 3 ? MIXED_TEMPLATES : NEGATIVE_TEMPLATES;
  const text = rng.pick(templates)(subjectName, dish);

  return { author, rating, text, createdAt: randomPastDate(rng, 540) };
}
