import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { goals, runs, type Run } from "@/lib/db/schema";
import { campaignStage } from "./campaign";
import { contentStage } from "./content";
import { researchStage } from "./research";
import { StagePause, type PipelineStage } from "./stage";
import { strategyStage } from "./strategy";

export type { PipelineStage, StageContext } from "./stage";
export { StagePause } from "./stage";

/** Registered in order. Adding a stage is a one-line change here — nothing else needs to know about it. */
export const STAGES: PipelineStage[] = [
  { name: "research", run: researchStage },
  { name: "strategy", run: strategyStage },
  { name: "content", run: contentStage },
  { name: "campaign", run: campaignStage },
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
 * A stage throwing StagePause stops the loop with status=awaiting_approval instead of failed,
 * leaving `stage` set to whichever stage paused so resumeRun knows where to continue.
 * Defaults to the registered STAGES; tests pass their own list to exercise failure handling. */
export async function runStages(run: Run, stages: PipelineStage[] = STAGES): Promise<void> {
  const db = getDb();
  const ctx = {
    runId: run.id,
    businessId: run.businessId,
    goalId: run.goalId,
  };

  for (const stage of stages) {
    // Clears any stale error from a previous failed attempt at this run (e.g. a retry) — without
    // this, a successful retry would leave old error text sitting in the row even though status
    // has moved past "failed".
    await db
      .update(runs)
      .set({ stage: stage.name, status: "running", error: null })
      .where(eq(runs.id, run.id));

    try {
      await stage.run(ctx);
    } catch (error) {
      if (error instanceof StagePause) {
        await db.update(runs).set({ status: "awaiting_approval" }).where(eq(runs.id, run.id));
        return;
      }
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

/** Resumes a paused run from the stage after the one it paused at. Callers are responsible for
 * deciding WHEN resuming is appropriate (e.g. checking >=1 creative is approved) — this function
 * is stage-agnostic and just continues wherever `run.stage` says it stopped. */
export async function resumeRun(runId: string, stages: PipelineStage[] = STAGES): Promise<Run> {
  const db = getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }
  if (run.status !== "awaiting_approval") {
    throw new Error(`Run ${runId} is not awaiting approval (status: ${run.status})`);
  }

  const pausedIndex = stages.findIndex((stage) => stage.name === run.stage);
  if (pausedIndex === -1) {
    throw new Error(`Cannot resume: stage "${run.stage}" is not in the registered stage list`);
  }

  const remainingStages = stages.slice(pausedIndex + 1);
  runStages(run, remainingStages).catch((error: unknown) => {
    console.error(`runStages crashed outside its own error handling for run ${run.id}`, error);
  });

  return run;
}

/** Re-runs a failed run starting AT the stage that failed (unlike resumeRun, which starts AFTER
 * the paused stage — a failed stage never completed, so retrying should attempt it again, not
 * skip it). */
export async function retryRun(runId: string, stages: PipelineStage[] = STAGES): Promise<Run> {
  const db = getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }
  if (run.status !== "failed") {
    throw new Error(`Run ${runId} is not failed (status: ${run.status})`);
  }

  const failedIndex = stages.findIndex((stage) => stage.name === run.stage);
  if (failedIndex === -1) {
    throw new Error(`Cannot retry: stage "${run.stage}" is not in the registered stage list`);
  }

  const remainingStages = stages.slice(failedIndex);
  runStages(run, remainingStages).catch((error: unknown) => {
    console.error(`runStages crashed outside its own error handling for run ${run.id}`, error);
  });

  return run;
}
