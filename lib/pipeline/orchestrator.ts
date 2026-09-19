import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { goals, runs, type Run } from "@/lib/db/schema";
import { researchStage } from "./research";
import { strategyStage } from "./strategy";

export interface StageContext {
  runId: string;
  businessId: string;
  goalId: string;
}

export interface PipelineStage {
  name: string;
  run(ctx: StageContext): Promise<void>;
}

/** Registered in order. Adding a stage is a one-line change here — nothing else needs to know about it. */
export const STAGES: PipelineStage[] = [
  { name: "research", run: researchStage },
  { name: "strategy", run: strategyStage },
];

export const STAGE_NAMES: readonly string[] = STAGES.map((stage) => stage.name);

/** Inserts the runs row. Callers that don't need to await stage completion should use startRun instead. */
export async function createRun(goalId: string): Promise<Run> {
  const db = getDb();
  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId));
  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  const [run] = await db
    .insert(runs)
    .values({
      businessId: goal.businessId,
      goalId: goal.id,
      stage: "pending",
      status: "running",
    })
    .returning();

  return run;
}

/** Executes stages in order against an already-created run, updating stage/status as it goes.
 * Defaults to the registered STAGES; tests pass their own list to exercise failure handling. */
export async function runStages(run: Run, stages: PipelineStage[] = STAGES): Promise<void> {
  const db = getDb();
  const ctx: StageContext = {
    runId: run.id,
    businessId: run.businessId,
    goalId: run.goalId,
  };

  for (const stage of stages) {
    await db
      .update(runs)
      .set({ stage: stage.name, status: "running" })
      .where(eq(runs.id, run.id));

    try {
      await stage.run(ctx);
    } catch (error) {
      await db
        .update(runs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        })
        .where(eq(runs.id, run.id));
      return;
    }
  }

  await db
    .update(runs)
    .set({ stage: "done", status: "done", finishedAt: new Date() })
    .where(eq(runs.id, run.id));
}

/** Creates a run and kicks off stage execution without waiting for it to finish — so this resolves
 * immediately even once real (slow, LLM-backed) stages are registered. Poll the run row for progress. */
export async function startRun(
  goalId: string,
  stages: PipelineStage[] = STAGES,
): Promise<Run> {
  const run = await createRun(goalId);
  runStages(run, stages).catch((error: unknown) => {
    // runStages already writes failures into the run row; this is only a backstop against a bug
    // in that error handling itself.
    console.error(`runStages crashed outside its own error handling for run ${run.id}`, error);
  });
  return run;
}
