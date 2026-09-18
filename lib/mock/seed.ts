try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional (e.g. in CI where DATABASE_URL is injected directly)
}

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  actions,
  campaignMetrics,
  campaigns,
  creatives,
  goals,
  mockCompetitors,
  mockReviews,
  mockSearchFixtures,
  observations,
  recommendations,
  researchReports,
  runs,
  strategies,
  businesses,
} from "@/lib/db/schema";
import { CampaignSpecSchema, type CampaignSpec } from "@/lib/schemas/campaignSpec";
import {
  CTA_OPTIONS,
  CreativeSchema,
  FORMAT_OPTIONS,
  type Creative,
} from "@/lib/schemas/creativeSet";
import { StrategySchema, type Strategy } from "@/lib/schemas/strategy";
import { SEED_BUSINESS } from "./data/business";
import { SEED_COMPETITORS } from "./data/competitors";
import { SEED_SEARCH_FIXTURES } from "./data/searchFixtures";
import { AUDIENCE_SEGMENTS } from "./data/audienceSegments";
import { generateExternalId } from "@/lib/adapters/mock/ads";
import { createRng, type Rng } from "./rng";
import { addDays, generateDailyMetrics, startOfUtcDay } from "./simulator";
import { generateReview } from "./reviews";

const REVIEWS_PER_BUSINESS = 12;
const REVIEWS_PER_COMPETITOR = 6;
const HISTORICAL_CAMPAIGN_COUNT = 40;

const OBJECTIVES = [
  "Drive weekend dinner reservations",
  "Promote the monsoon comfort-food menu",
  "Boost weekday lunch footfall from nearby offices",
  "Grow awareness for the weekend live-music nights",
  "Increase Instagram-driven walk-ins during tourist season",
] as const;

const HOOKS = [
  "Sunset views, sussegad pace, and the best balchão in Fontainhas.",
  "Your Friday night just got a soundtrack — live acoustic sets every weekend.",
  "Monsoon special: comfort food that tastes like home, Goan-style.",
  "Tourist season is here — grab the table with the best sunset in Panjim.",
  "Weekday lunch, sorted: quick, generous, and properly Goan.",
] as const;

const CAPTIONS = [
  "Slow down, sussegad-style 🌴 Fresh catch, home-style spice, and a view that doesn't rush you.",
  "Live music, cold feni sours, and a menu that changes with the season. See you this weekend 🎶",
  "Comfort food for the rainy season — book ahead, tables go fast on weekends.",
  "Panjim's best-kept dinner secret (until now) 🦐",
] as const;

const HEADLINES = [
  "Panjim's Sussegad Table",
  "Dinner With a View",
  "Goan Comfort, Reinvented",
  "Weekend Live Music Nights",
] as const;

const IMAGE_PROMPT =
  "Warm, golden-hour photo of a plated Goan dish at a rustic Fontainhas restaurant table, shallow depth of field.";

const HISTORICAL_STRATEGY_OUTPUT: Strategy = {
  objective:
    "Establish a 12-month baseline of Meta Ads performance ahead of the AI-driven pipeline.",
  audience: "Panjim dinner & weekend diners across tourist and local segments",
  channels: ["meta_ads"],
  offer: "Rotating seasonal set-menu and live-music promotions",
  messaging_pillars: [
    "Sussegad, unhurried dining experience",
    "Authentic Goan-Portuguese fusion",
    "Weekend live acoustic music",
  ],
  daily_budget: 600,
  kpis: [
    { name: "average_cpa_inr", target: 130 },
    { name: "average_ctr_pct", target: 2.5 },
  ],
  rationale:
    "Synthetic baseline strategy used only to backfill 12 months of historical campaign data for benchmarking; not produced by the real strategy stage.",
};

function buildCreativeContent(rng: Rng, index: number): Creative {
  const content: Creative = {
    id: `c${index + 1}`,
    hook: rng.pick(HOOKS),
    caption: rng.pick(CAPTIONS),
    headline: rng.pick(HEADLINES),
    cta: rng.pick(CTA_OPTIONS),
    image_prompt: IMAGE_PROMPT,
    format: rng.pick(FORMAT_OPTIONS),
  };
  return CreativeSchema.parse(content);
}

function randomCampaignWindow(rng: Rng): { start: Date; end: Date } {
  const today = startOfUtcDay(new Date());
  const durationDays = rng.int(5, 14);
  const daysAgoForEnd = rng.int(1, 350);
  const end = addDays(today, -daysAgoForEnd);
  const start = addDays(end, -(durationDays - 1));
  return { start, end };
}

async function main() {
  const db = getDb();
  const rng = createRng("growthos-seed-v1");

  await db.transaction(async (tx) => {
    await tx.delete(actions);
    await tx.delete(recommendations);
    await tx.delete(observations);
    await tx.delete(campaignMetrics);
    await tx.delete(campaigns);
    await tx.delete(creatives);
    await tx.delete(strategies);
    await tx.delete(researchReports);
    await tx.delete(runs);
    await tx.delete(goals);
    await tx.delete(mockReviews);
    await tx.delete(mockCompetitors);
    await tx.delete(mockSearchFixtures);
    await tx.delete(businesses);

    const [business] = await tx
      .insert(businesses)
      .values(SEED_BUSINESS)
      .returning();

    const competitorRows = await tx
      .insert(mockCompetitors)
      .values(
        SEED_COMPETITORS.map((c) => ({
          businessId: business.id,
          name: c.name,
          area: c.area,
          cuisine: c.cuisine,
          priceBand: c.priceBand,
          instagramFollowers: c.instagramFollowers,
          rating: c.rating.toFixed(1),
        })),
      )
      .returning();

    const reviewRows: (typeof mockReviews.$inferInsert)[] = [];
    for (let i = 0; i < REVIEWS_PER_BUSINESS; i++) {
      const review = generateReview(rng, business.name);
      reviewRows.push({
        subjectType: "business",
        subjectId: business.id,
        author: review.author,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt,
      });
    }
    for (const competitor of competitorRows) {
      for (let i = 0; i < REVIEWS_PER_COMPETITOR; i++) {
        const review = generateReview(rng, competitor.name);
        reviewRows.push({
          subjectType: "competitor",
          subjectId: competitor.id,
          author: review.author,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
        });
      }
    }
    await tx.insert(mockReviews).values(reviewRows);

    await tx.insert(mockSearchFixtures).values(
      SEED_SEARCH_FIXTURES.map((fixture) => ({
        queryPattern: fixture.queryPattern,
        results: fixture.results,
      })),
    );

    const [goal] = await tx
      .insert(goals)
      .values({
        businessId: business.id,
        text: "Benchmark historical Meta Ads performance before onboarding the AI pipeline",
        status: "archived",
      })
      .returning();

    const [run] = await tx
      .insert(runs)
      .values({
        businessId: business.id,
        goalId: goal.id,
        stage: "seed",
        status: "done",
        finishedAt: new Date(),
      })
      .returning();

    const [strategy] = await tx
      .insert(strategies)
      .values({
        runId: run.id,
        output: StrategySchema.parse(HISTORICAL_STRATEGY_OUTPUT),
        status: "historical",
      })
      .returning();

    for (let i = 0; i < HISTORICAL_CAMPAIGN_COUNT; i++) {
      const creativeCount = rng.int(3, 4);
      const creativeContents = Array.from({ length: creativeCount }, (_, idx) =>
        buildCreativeContent(rng, idx),
      );
      const creativeRows = await tx
        .insert(creatives)
        .values(
          creativeContents.map((content) => ({
            strategyId: strategy.id,
            output: content,
            status: "approved",
          })),
        )
        .returning();

      const { start, end } = randomCampaignWindow(rng);
      const dailyBudget = rng.int(250, 1000);
      const audience = rng.pick(AUDIENCE_SEGMENTS).name;

      const spec: CampaignSpec = CampaignSpecSchema.parse({
        platform: "meta_ads",
        objective: rng.pick(OBJECTIVES),
        audience,
        daily_budget: dailyBudget,
        creative_ids: creativeRows.map((c) => c.id),
        cta: creativeContents[0].cta,
        schedule: {
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        },
      });

      const [campaign] = await tx
        .insert(campaigns)
        .values({
          strategyId: strategy.id,
          spec,
          externalId: generateExternalId(),
          status: "completed",
          dailyBudget,
          creativeWeights: null,
        })
        .returning();

      const metricRows: (typeof campaignMetrics.$inferInsert)[] = [];
      const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      for (let day = 0; day < durationDays; day++) {
        const date = addDays(start, day);
        const dayMetrics = generateDailyMetrics({
          campaignId: campaign.id,
          creativeIds: spec.creative_ids,
          dailyBudget,
          baselineBudget: dailyBudget,
          weights: null,
          date,
        });
        for (const metric of dayMetrics) {
          metricRows.push({
            campaignId: campaign.id,
            creativeId: metric.creativeId,
            date: metric.date,
            impressions: metric.impressions,
            clicks: metric.clicks,
            spend: metric.spend.toFixed(2),
            conversions: metric.conversions,
          });
        }
      }
      await tx.insert(campaignMetrics).values(metricRows);
    }
  });

  console.log("Seed complete: 1 business, 8 competitors, 60 reviews, 40 historical campaigns.");

  const sampleReviews = await db.select().from(mockReviews).limit(5);
  console.log("\nSample reviews:");
  for (const review of sampleReviews) {
    console.log(`  [${review.rating}★] ${review.author}: ${review.text}`);
  }

  const [sampleCampaign] = await db.select().from(campaigns).limit(1);
  if (sampleCampaign) {
    const sampleMetrics = await db
      .select()
      .from(campaignMetrics)
      .where(eq(campaignMetrics.campaignId, sampleCampaign.id));
    console.log(`\nSample campaign ${sampleCampaign.id} (${sampleMetrics.length} metric rows):`);
    for (const metric of sampleMetrics.slice(0, 8)) {
      console.log(
        `  ${metric.date.toISOString().slice(0, 10)} creative=${metric.creativeId.slice(0, 8)} ` +
          `impressions=${metric.impressions} clicks=${metric.clicks} spend=₹${metric.spend} conversions=${metric.conversions}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // The postgres.js connection stays open otherwise, and the process never exits.
    process.exit(process.exitCode ?? 0);
  });
