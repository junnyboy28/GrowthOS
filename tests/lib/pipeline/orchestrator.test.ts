import { beforeEach, describe, expect, it, vi } from "vitest";
import { goals, runs } from "@/lib/db/schema";

interface FakeGoal {
  id: string;
  businessId: string;
}

interface FakeRun {
  id: string;
  businessId: string;
  goalId: string;
  stage: string;
  status: string;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

const GOAL: FakeGoal = { id: "goal-1", businessId: "business-1" };

let runRow: FakeRun | null = null;
let nextId = 1;

function makeFakeDb() {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === goals) return [GOAL];
          if (table === runs) return runRow ? [runRow] : [];
          return [];
        },
      }),
    }),
    insert: () => ({
      values: (values: Partial<FakeRun>) => ({
        returning: async () => {
          runRow = {
            id: `run-${nextId++}`,
            businessId: GOAL.businessId,
            goalId: GOAL.id,
            stage: "pending",
            status: "pending",
            error: null,
            startedAt: new Date(),
            finishedAt: null,
            ...values,
          };
          return [runRow];
        },
      }),
    }),
    update: () => ({
      set: (values: Partial<FakeRun>) => ({
        where: async () => {
          if (!runRow) throw new Error("no run to update");
          runRow = { ...runRow, ...values };
        },
      }),
    }),
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: () => makeFakeDb(),
}));

const { createRun, resumeRun, runStages, StagePause } = await import("@/lib/pipeline/orchestrator");

beforeEach(() => {
  runRow = null;
});

describe("orchestrator", () => {
  it("moves a run to done when there are no stages", async () => {
    const run = await createRun(GOAL.id);
    await runStages(run, []);

    expect(runRow?.stage).toBe("done");
    expect(runRow?.status).toBe("done");
    expect(runRow?.finishedAt).not.toBeNull();
    expect(runRow?.error).toBeNull();
  });

  it("runs stages in order and stops at the first failure", async () => {
    const order: string[] = [];
    const goodStage = {
      name: "good",
      run: vi.fn(async () => {
        order.push("good");
      }),
    };
    const throwingStage = {
      name: "throwing",
      run: vi.fn(async () => {
        order.push("throwing");
        throw new Error("stage exploded");
      }),
    };
    const neverReachedStage = {
      name: "never-reached",
      run: vi.fn(async () => {
        order.push("never-reached");
      }),
    };

    const run = await createRun(GOAL.id);
    await runStages(run, [goodStage, throwingStage, neverReachedStage]);

    expect(order).toEqual(["good", "throwing"]);
    expect(goodStage.run).toHaveBeenCalledTimes(1);
    expect(throwingStage.run).toHaveBeenCalledTimes(1);
    expect(neverReachedStage.run).not.toHaveBeenCalled();

    expect(runRow?.stage).toBe("throwing");
    expect(runRow?.status).toBe("failed");
    expect(runRow?.error).toBe("stage exploded");
    expect(runRow?.finishedAt).not.toBeNull();
  });

  it("marks each stage as running before invoking it", async () => {
    const seenStatusAtRunTime: string[] = [];
    const stage = {
      name: "solo",
      run: vi.fn(async () => {
        seenStatusAtRunTime.push(runRow?.status ?? "missing");
        seenStatusAtRunTime.push(runRow?.stage ?? "missing");
      }),
    };

    const run = await createRun(GOAL.id);
    await runStages(run, [stage]);

    expect(seenStatusAtRunTime).toEqual(["running", "solo"]);
    expect(runRow?.status).toBe("done");
  });
});

describe("orchestrator pause/resume", () => {
  it("pauses instead of failing when a stage throws StagePause", async () => {
    const order: string[] = [];
    const pausingStage = {
      name: "content",
      run: vi.fn(async () => {
        order.push("content");
        throw new StagePause("waiting for approval");
      }),
    };
    const neverReachedStage = {
      name: "campaign",
      run: vi.fn(async () => {
        order.push("campaign");
      }),
    };

    const run = await createRun(GOAL.id);
    await runStages(run, [pausingStage, neverReachedStage]);

    expect(order).toEqual(["content"]);
    expect(neverReachedStage.run).not.toHaveBeenCalled();
    expect(runRow?.stage).toBe("content");
    expect(runRow?.status).toBe("awaiting_approval");
    expect(runRow?.finishedAt).toBeNull();
    expect(runRow?.error).toBeNull();
  });

  it("continues from where it paused when runStages is re-invoked with the remaining stages", async () => {
    const pausingStage = {
      name: "content",
      run: vi.fn(async () => {
        throw new StagePause("waiting for approval");
      }),
    };
    const nextStage = { name: "campaign", run: vi.fn(async () => {}) };

    const run = await createRun(GOAL.id);
    await runStages(run, [pausingStage, nextStage]);
    expect(runRow?.status).toBe("awaiting_approval");

    // This is exactly what resumeRun does internally: re-invoke runStages with the slice after
    // the paused stage.
    await runStages(run, [nextStage]);

    expect(nextStage.run).toHaveBeenCalledTimes(1);
    expect(runRow?.stage).toBe("done");
    expect(runRow?.status).toBe("done");
    expect(runRow?.finishedAt).not.toBeNull();
  });

  it("resumeRun rejects if the run is not awaiting approval", async () => {
    const run = await createRun(GOAL.id);
    await expect(resumeRun(run.id, [])).rejects.toThrow(/not awaiting approval/i);
  });

  it("resumeRun rejects if the paused stage isn't in the provided stage list", async () => {
    const pausingStage = {
      name: "content",
      run: vi.fn(async () => {
        throw new StagePause("waiting for approval");
      }),
    };
    const run = await createRun(GOAL.id);
    await runStages(run, [pausingStage]);
    expect(runRow?.status).toBe("awaiting_approval");

    await expect(
      resumeRun(run.id, [{ name: "other", run: vi.fn(async () => {}) }]),
    ).rejects.toThrow(/not in the registered stage list/i);
  });

  it("resumeRun kicks off the remaining stages and eventually reaches done", async () => {
    const pausingStage = {
      name: "content",
      run: vi.fn(async () => {
        throw new StagePause("waiting for approval");
      }),
    };
    const nextStage = { name: "campaign", run: vi.fn(async () => {}) };

    const run = await createRun(GOAL.id);
    await runStages(run, [pausingStage, nextStage]);
    expect(runRow?.status).toBe("awaiting_approval");

    await resumeRun(run.id, [pausingStage, nextStage]);
    // resumeRun fires runStages without awaiting it; flush the microtask queue.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(nextStage.run).toHaveBeenCalledTimes(1);
    expect(runRow?.status).toBe("done");
  });
});
