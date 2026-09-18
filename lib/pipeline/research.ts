import { getSearchProvider } from "@/lib/adapters";
import { getDb } from "@/lib/db/client";
import { researchReports, toolCalls, type Business, type Goal, type MockCompetitorRow, type MockReviewRow } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries/businesses";
import { getGoalById } from "@/lib/db/queries/goals";
import { getCompetitorsForBusiness, getReviewsForBusiness } from "@/lib/db/queries/mock";
import { structured } from "@/lib/llm/structured";
import type { EvidenceItem } from "@/lib/schemas/evidence";
import { ResearchOutputSchema, type ResearchOutput } from "@/lib/schemas/researchOutput";
import type { StageContext } from "./orchestrator";
import { researchSystemPrompt, researchUserPrompt } from "./research.prompt";

const STAGE_NAME = "research";

function extractRegion(location: string): string {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : location;
}

/** 4-6 queries: a fixed set of general ones plus the top competitors by reach. */
function buildSearchQueries(business: Business, competitors: MockCompetitorRow[]): string[] {
  const region = extractRegion(business.location);
  const baseQueries = [
    `${business.industry} ${business.location}`,
    `${region} ${business.industry} marketing trends`,
    `${region} tourist season trends`,
    `${business.industry} customer segments ${region}`,
  ];

  const competitorQueries = [...competitors]
    .sort((a, b) => b.instagramFollowers - a.instagramFollowers)
    .slice(0, 2)
    .map((competitor) => `${competitor.name} ${competitor.area}`);

  return [...baseQueries, ...competitorQueries].slice(0, 6);
}

async function assembleEvidenceBundle(params: {
  runId: string;
  business: Business;
  competitors: MockCompetitorRow[];
  reviews: MockReviewRow[];
}): Promise<EvidenceItem[]> {
  const { runId, business, competitors, reviews } = params;
  const db = getDb();
  const items: EvidenceItem[] = [];
  let counter = 1;
  const nextId = () => `e${counter++}`;

  for (const competitor of competitors) {
    items.push({
      id: nextId(),
      source: `competitor_profile:${competitor.name}`,
      snippet:
        `${competitor.name} — ${competitor.cuisine} cuisine in ${competitor.area}, ` +
        `${competitor.priceBand} price band, ${competitor.instagramFollowers} Instagram followers, ` +
        `${competitor.rating}★ rating.`,
    });
  }

  const competitorNameById = new Map(competitors.map((competitor) => [competitor.id, competitor.name]));
  for (const review of reviews) {
    const subjectLabel =
      review.subjectType === "business"
        ? business.name
        : competitorNameById.get(review.subjectId) ?? "competitor";
    items.push({
      id: nextId(),
      source: `review:${subjectLabel}`,
      snippet: `[${review.rating}★] ${review.author}: ${review.text}`,
    });
  }

  const searchProvider = getSearchProvider();
  const queries = buildSearchQueries(business, competitors);
  const seenResultIds = new Set<string>();

  for (const query of queries) {
    const startedAt = Date.now();
    const results = await searchProvider.search(query);
    const latencyMs = Date.now() - startedAt;

    await db.insert(toolCalls).values({
      runId,
      tool: "search",
      input: { query },
      output: results,
      latencyMs,
    });

    for (const result of results) {
      if (seenResultIds.has(result.id)) continue;
      seenResultIds.add(result.id);
      items.push({
        id: nextId(),
        source: `search:${query}`,
        snippet: `${result.title} — ${result.snippet}`,
      });
    }
  }

  return items;
}

class InvalidSourceIdsError extends Error {
  constructor(public readonly invalidIds: string[]) {
    super(`Cited source_ids not found in the evidence bundle: ${invalidIds.join(", ")}`);
  }
}

function collectCitedIds(output: ResearchOutput): string[] {
  return [
    ...output.target_segments.flatMap((segment) => segment.source_ids),
    ...output.competitors.flatMap((competitor) => competitor.source_ids),
    ...output.opportunities.flatMap((opportunity) => opportunity.source_ids),
    ...output.pain_points.flatMap((painPoint) => painPoint.source_ids),
  ];
}

async function callResearchLlm(params: {
  runId: string;
  business: Business;
  goal: Goal;
  evidenceBundle: EvidenceItem[];
}): Promise<ResearchOutput> {
  const { runId, business, goal, evidenceBundle } = params;
  const bundleIds = new Set(evidenceBundle.map((item) => item.id));
  const modelEnv = process.env.MODEL_FAST;
  if (!modelEnv) {
    throw new Error("MODEL_FAST is not set");
  }
  const model: string = modelEnv;

  async function attempt(correctionNote?: string): Promise<ResearchOutput> {
    const output = await structured({
      model,
      system: researchSystemPrompt(business),
      user: researchUserPrompt({ goal, evidenceBundle, correctionNote }),
      schema: ResearchOutputSchema,
      runId,
      stage: STAGE_NAME,
    });

    const citedIds = collectCitedIds(output);
    const invalidIds = [...new Set(citedIds.filter((id) => !bundleIds.has(id)))];
    if (invalidIds.length > 0) {
      throw new InvalidSourceIdsError(invalidIds);
    }

    // Deterministically rebuild `evidence` from the real bundle rather than trusting the LLM's
    // transcription of it, so what's persisted always matches the source of truth exactly.
    const citedIdSet = new Set(citedIds);
    return {
      ...output,
      evidence: evidenceBundle.filter((item) => citedIdSet.has(item.id)),
    };
  }

  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof InvalidSourceIdsError)) {
      throw error;
    }
    return await attempt(
      `Your previous response cited these source_ids that do NOT exist in the evidence bundle: ` +
        `${error.invalidIds.join(", ")}. Use only ids that appear in the bundle above.`,
    );
  }
}

export async function researchStage(ctx: StageContext): Promise<void> {
  const [business, goal] = await Promise.all([
    getBusinessById(ctx.businessId),
    getGoalById(ctx.goalId),
  ]);
  if (!business) throw new Error(`Business ${ctx.businessId} not found`);
  if (!goal) throw new Error(`Goal ${ctx.goalId} not found`);

  const competitors = await getCompetitorsForBusiness(business.id);
  const reviews = await getReviewsForBusiness(
    business.id,
    competitors.map((competitor) => competitor.id),
  );

  const evidenceBundle = await assembleEvidenceBundle({
    runId: ctx.runId,
    business,
    competitors,
    reviews,
  });

  const output = await callResearchLlm({ runId: ctx.runId, business, goal, evidenceBundle });

  const db = getDb();
  await db.insert(researchReports).values({
    runId: ctx.runId,
    output,
  });
}
