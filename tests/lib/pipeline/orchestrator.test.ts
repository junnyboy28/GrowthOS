import { beforeEach, describe, expect, it, vi } from "vitest";

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
      from: () => ({
        where: async () => [GOAL],
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

const { createRun, runStages } = await import("@/lib/pipeline/orchestrator");

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
