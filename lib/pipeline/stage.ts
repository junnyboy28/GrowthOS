export interface StageContext {
  runId: string;
  businessId: string;
  goalId: string;
}

export interface PipelineStage {
  name: string;
  run(ctx: StageContext): Promise<void>;
}

/**
 * Thrown by a stage to signal that the orchestrator should stop advancing and mark the run
 * `awaiting_approval` rather than `failed` — used by content.ts's human-approval gate. Lives in
 * its own module (not orchestrator.ts) so stages can import it without a circular value dependency
 * (orchestrator.ts imports stage functions as values; stages only need types back from it otherwise).
 */
export class StagePause extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StagePause";
  }
}
