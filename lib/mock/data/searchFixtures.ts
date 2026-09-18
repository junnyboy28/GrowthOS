export interface SeedSearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

export interface SeedSearchFixture {
  queryPattern: string;
  results: SeedSearchResult[];
}

let counter = 0;
function sr(title: string, snippet: string, url: string): SeedSearchResult {
  counter += 1;
  return { id: `sr-${String(counter).padStart(3, "0")}`, title, snippet, url };
}

export const SEED_SEARCH_FIXTURES: SeedSearchFixture[] = [
  {
    queryPattern: "maré alta panjim reviews",
    results: [
      sr(
        "Maré Alta, Fontainhas — Reviews",
        "Goan-Portuguese mid-range spot in Fontainhas, 4.3★, praised for balchão and heritage-house seating.",
        "https://example.com/review/mare-alta",
      ),
      sr(
        "Maré Alta Instagram",
        "11.4K followers, posts heritage-architecture reels and weekend set-menu promos.",
        "https://instagram.com/marealta.goa",
      ),
      sr(
        "Maré Alta menu & pricing",
        "Mains ₹350-650, known for a fixed-price Sunday feast that sells out by 8pm.",
        "https://example.com/menu/mare-alta",
      ),
    ],
  },
  {
    queryPattern: "zuari bay grill campal",
    results: [
      sr(
        "Zuari Bay Grill — premium seafood, Campal",
        "Premium seafood grill, 4.5★, 19.8K Instagram followers, popular with tourists for river-view dining.",
        "https://example.com/review/zuari-bay-grill",
      ),
      sr(
        "Zuari Bay Grill weekend crowds",
        "Frequently fully booked Fri-Sun; diners cite premium pricing but consistent quality.",
        "https://example.com/forum/zuari-bay-grill",
      ),
    ],
  },
  {
    queryPattern: "feni & fire miramar",
    results: [
      sr(
        "Feni & Fire, Miramar — contemporary Goan",
        "Mid-range contemporary Goan kitchen, 4.2★, known for feni-based cocktails and small plates.",
        "https://example.com/review/feni-fire",
      ),
      sr(
        "Feni & Fire social reach",
        "8.6K Instagram followers, active with cocktail-pairing reels.",
        "https://instagram.com/feniandfire",
      ),
    ],
  },
  {
    queryPattern: "costa verde kitchen 18th june road",
    results: [
      sr(
        "Costa Verde Kitchen — budget continental",
        "Budget continental cafe on 18th June Road, 3.9★, mixed reviews on service speed.",
        "https://example.com/review/costa-verde-kitchen",
      ),
      sr(
        "Costa Verde Kitchen social presence",
        "3.4K Instagram followers, mostly food-photography posts with limited promo activity.",
        "https://instagram.com/costaverdekitchen",
      ),
    ],
  },
  {
    queryPattern: "baga breeze diner dona paula",
    results: [
      sr(
        "Baga Breeze Diner, Dona Paula",
        "Premium multi-cuisine diner, 21.5K followers, strong sunset-view marketing angle.",
        "https://example.com/review/baga-breeze-diner",
      ),
      sr(
        "Baga Breeze Diner pricing complaints",
        "Some reviewers note premium pricing doesn't always match portion sizes.",
        "https://example.com/forum/baga-breeze-diner",
      ),
    ],
  },
  {
    queryPattern: "tia rosa's altinho cafe",
    results: [
      sr(
        "Tia Rosa's, Altinho — top-rated cafe",
        "Mid-range cafe, highest rating in the area at 4.6★, 14.2K followers, known for brunch and coffee.",
        "https://example.com/review/tia-rosas",
      ),
    ],
  },
  {
    queryPattern: "sal river kitchen caranzalem",
    results: [
      sr(
        "Sal River Kitchen, Caranzalem",
        "Budget Goan-seafood spot, 4.0★, popular with locals for weekday thalis.",
        "https://example.com/review/sal-river-kitchen",
      ),
      sr(
        "Sal River Kitchen weekday lunch crowd",
        "Draws a steady local lunch crowd on weekdays; quieter in the evenings compared to Fontainhas venues.",
        "https://example.com/forum/sal-river-kitchen",
      ),
    ],
  },
  {
    queryPattern: "chorão table santa cruz",
    results: [
      sr(
        "Chorão Table, Santa Cruz — fusion menu",
        "Mid-range fusion restaurant, 4.4★, 7.3K followers, known for a rotating tasting menu.",
        "https://example.com/review/chorao-table",
      ),
      sr(
        "Chorão Table booking patterns",
        "Tasting menu nights require advance booking; regarded as one of the better-reviewed fusion spots in Santa Cruz.",
        "https://example.com/forum/chorao-table",
      ),
    ],
  },
  {
    queryPattern: "restaurants panjim",
    results: [
      sr(
        "Panjim dining scene overview",
        "Fontainhas and Campal lead Panjim's dining scene; Goan-Portuguese fusion and seafood dominate listings.",
        "https://example.com/guide/panjim-restaurants",
      ),
      sr(
        "Best restaurants in Panjim 2026",
        "Roundup highlights heritage-house dining and weekend live-music venues as the top draw for visitors.",
        "https://example.com/list/panjim-2026",
      ),
      sr(
        "Panjim restaurant footfall patterns",
        "Footfall peaks Thu-Sun evenings; weekday lunch stays flat except near Patto business district.",
        "https://example.com/data/panjim-footfall",
      ),
    ],
  },
  {
    queryPattern: "dinner offers goa",
    results: [
      sr(
        "Goa restaurants lean on set-menu dinner deals",
        "Fixed-price sunset dinner menus are the most common promo format across mid-range Goa restaurants.",
        "https://example.com/article/goa-dinner-deals",
      ),
      sr(
        "Weekday dinner discount trend",
        "Several Panjim restaurants run 20-30% weekday dinner discounts to offset slow Mon-Wed footfall.",
        "https://example.com/article/weekday-discounts-goa",
      ),
    ],
  },
  {
    queryPattern: "goa restaurant marketing trends",
    results: [
      sr(
        "Instagram reels drive Goa restaurant bookings",
        "Short-form video of ambience and live music consistently outperforms static posts for Goa F&B accounts.",
        "https://example.com/article/goa-fnb-instagram",
      ),
      sr(
        "Influencer partnerships in Goa's F&B scene",
        "Micro-influencer collabs (5K-20K followers) show the best cost-per-visit for mid-range restaurants.",
        "https://example.com/article/goa-influencer-fnb",
      ),
    ],
  },
  {
    queryPattern: "goa tourist season trends",
    results: [
      sr(
        "Goa tourism seasonality",
        "Peak season runs mid-December through January; footfall and ad costs both rise sharply in this window.",
        "https://example.com/data/goa-tourism-seasonality",
      ),
      sr(
        "Monsoon slowdown for Goa F&B",
        "June-September sees a marked drop in tourist covers; local weekday traffic becomes the main revenue driver.",
        "https://example.com/article/goa-monsoon-fnb",
      ),
    ],
  },
  {
    queryPattern: "goan cuisine trends panjim",
    results: [
      sr(
        "Modern Goan-Portuguese fusion on the rise",
        "Panjim diners increasingly favour reinterpreted classics (balchão, xacuti) over traditional presentation.",
        "https://example.com/article/goan-fusion-trend",
      ),
    ],
  },
  {
    queryPattern: "restaurant instagram followers benchmark goa",
    results: [
      sr(
        "Typical Instagram following for Panjim restaurants",
        "Mid-range Panjim restaurants average 5K-15K followers; premium venues with view-driven appeal exceed 20K.",
        "https://example.com/data/goa-restaurant-instagram-benchmark",
      ),
    ],
  },
  {
    queryPattern: "weekend live music goa restaurants",
    results: [
      sr(
        "Live-music nights as a differentiator",
        "Restaurants offering weekend acoustic sets report noticeably higher average ticket size and dwell time.",
        "https://example.com/article/goa-live-music-dining",
      ),
    ],
  },
];
