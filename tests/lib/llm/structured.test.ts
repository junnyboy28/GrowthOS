import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.fn();
const insertValues = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/llm/client", () => ({
  getAnthropicClient: () => ({
    messages: { create },
  }),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    insert: () => ({ values: insertValues }),
  }),
}));

const { structured } = await import("@/lib/llm/structured");

const schema = z.object({ name: z.string() });

function toolUseResponse(input: unknown) {
  return {
    content: [
      { type: "tool_use", id: "toolu_1", name: "emit_output", input },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

const baseOpts = {
  model: "test-model",
  system: "system",
  user: "user",
  schema,
  runId: null,
  stage: "test",
};

beforeEach(() => {
  create.mockReset();
  insertValues.mockClear();
});

describe("structured()", () => {
  it("returns parsed output on the first successful call", async () => {
    create.mockResolvedValueOnce(toolUseResponse({ name: "Alice" }));

    const result = await structured(baseOpts);

    expect(result).toEqual({ name: "Alice" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it("retries once with the zod error appended and succeeds on the second call", async () => {
    create
      .mockResolvedValueOnce(toolUseResponse({ name: 123 }))
      .mockResolvedValueOnce(toolUseResponse({ name: "Bob" }));

    const result = await structured(baseOpts);

    expect(result).toEqual({ name: "Bob" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledTimes(2);

    const secondCallArgs = create.mock.calls[1][0];
    expect(secondCallArgs.messages[0].content).toContain(
      "failed schema validation",
    );
  });

  it("throws after the retry also fails validation", async () => {
    create
      .mockResolvedValueOnce(toolUseResponse({ name: 123 }))
      .mockResolvedValueOnce(toolUseResponse({ name: 456 }));

    await expect(structured(baseOpts)).rejects.toThrow(/failed after retry/);

    expect(create).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledTimes(2);
  });
});
