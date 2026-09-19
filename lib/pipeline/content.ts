import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatives, type Business, type CreativeRow } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries/businesses";
import { getCreativeWithContext } from "@/lib/db/queries/creatives";
import { getLatestStrategyForRun } from "@/lib/db/queries/strategies";
import { structured } from "@/lib/llm/structured";
import { CreativeSchema, CreativeSetSchema, type Creative, type CreativeSet } from "@/lib/schemas/creativeSet";
import type { Strategy } from "@/lib/schemas/strategy";
import { StagePause, type StageContext } from "./stage";
import {
  contentRegenerateUserPrompt,
  contentSingleSystemPrompt,
  contentSystemPrompt,
  contentUserPrompt,
} from "./content.prompt";

const STAGE_NAME = "content";
const CREATIVE_COUNT = 4;

class InvalidCreativeSetError extends Error {
  constructor(public readonly count: number) {
    super(`Expected exactly ${CREATIVE_COUNT} creatives, got ${count}`);
  }
}

function requireModelFast(): string {
  const model = process.env.MODEL_FAST;
  if (!model) {
    throw new Error("MODEL_FAST is not set");
  }
  return model;
}

/** Generates the initial 4-creative batch, persists it as pending, then pauses the run for
 * human approval — a successful generation still ends in a thrown StagePause, never a normal
 * return, since "done" here always means "waiting on the user." */
export async function contentStage(ctx: StageContext): Promise<void> {
  const businessRow = await getBusinessById(ctx.businessId);
  if (!businessRow) throw new Error(`Business ${ctx.businessId} not found`);
  const business: Business = businessRow;

  const strategyRow = await getLatestStrategyForRun(ctx.runId);
  if (!strategyRow) throw new Error(`No strategy found for run ${ctx.runId}`);
  const strategy: Strategy = strategyRow.output;

  const model = requireModelFast();

  async function attempt(correctionNote?: string): Promise<CreativeSet> {
    const output = await structured({
      model,
      system: contentSystemPrompt(business),
      user: contentUserPrompt({ strategy, correctionNote }),
      schema: CreativeSetSchema,
      runId: ctx.runId,
      stage: STAGE_NAME,
    });

    if (output.creatives.length !== CREATIVE_COUNT) {
      throw new InvalidCreativeSetError(output.creatives.length);
    }
    return output;
  }

  let output: CreativeSet;
  try {
    output = await attempt();
  } catch (error) {
    if (!(error instanceof InvalidCreativeSetError)) {
      throw error;
    }
    output = await attempt(
      `Your previous response returned ${error.count} creatives; you must return exactly ` +
        `${CREATIVE_COUNT}. Try again.`,
    );
  }

  const db = getDb();
  await db.insert(creatives).values(
    output.creatives.map((creative) => ({
      strategyId: strategyRow.id,
      output: creative,
      status: "pending",
    })),
  );

  throw new StagePause("Waiting for at least one creative to be approved before continuing.");
}

/** Regenerates a single rejected creative in place — updates the existing row rather than
 * inserting a new one, since this is editing the same card, not proposing an alternative. */
export async function regenerateCreative(creativeId: string): Promise<CreativeRow> {
  const context = await getCreativeWithContext(creativeId);
  if (!context) {
    throw new Error(`Creative ${creativeId} not found`);
  }
  const { creative, strategy, business, runId } = context;
  const rejectedCreative = creative.output as Creative;

  const model = requireModelFast();

  const newCreative = await structured({
    model,
    system: contentSingleSystemPrompt(business),
    user: contentRegenerateUserPrompt({ strategy: strategy.output, rejectedCreative }),
    schema: CreativeSchema,
    runId,
    stage: STAGE_NAME,
  });

  const db = getDb();
  const [updated] = await db
    .update(creatives)
    .set({ output: newCreative, status: "pending" })
    .where(eq(creatives.id, creativeId))
    .returning();

  return updated;
}
