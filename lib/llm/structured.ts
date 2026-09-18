import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { llmCalls } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { getAnthropicClient } from "./client";
import { costInr } from "./pricing";

export interface StructuredOptions<T> {
  model: string;
  system: string | Anthropic.Messages.TextBlockParam[];
  user: string;
  schema: z.ZodType<T>;
  runId: string | null;
  stage: string;
}

const TOOL_NAME = "emit_output";

/**
 * Anthropic tool `input_schema` must be a top-level JSON object schema. If the
 * Zod schema is not itself an object (e.g. a bare discriminated union), wrap it
 * under a synthetic `result` key and unwrap on the way back out.
 */
function buildToolInputSchema<T>(schema: z.ZodType<T>): {
  inputSchema: Anthropic.Messages.Tool.InputSchema;
  wrapped: boolean;
} {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  if (jsonSchema.type === "object") {
    return {
      inputSchema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
      wrapped: false,
    };
  }

  return {
    inputSchema: {
      type: "object",
      properties: { result: jsonSchema },
      required: ["result"],
    },
    wrapped: true,
  };
}

async function logCall(entry: {
  runId: string | null;
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(llmCalls).values({
    runId: entry.runId,
    stage: entry.stage,
    model: entry.model,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    latencyMs: entry.latencyMs,
    costInr: costInr(entry.model, entry.inputTokens, entry.outputTokens).toFixed(4),
  });
}

/**
 * Forces the model to return JSON matching `schema` via a single forced tool
 * call. Retries once with the Zod error appended on a parse failure, logging
 * every attempt to llm_calls, then throws if the retry also fails.
 */
export async function structured<T>(opts: StructuredOptions<T>): Promise<T> {
  const { model, system, user, schema, runId, stage } = opts;
  const client = getAnthropicClient();
  const { inputSchema, wrapped } = buildToolInputSchema(schema);

  const tool: Anthropic.Messages.Tool = {
    name: TOOL_NAME,
    description: "Return the output matching the required schema.",
    input_schema: inputSchema,
  };

  const attempt = async (userMessage: string) => {
    const startedAt = Date.now();
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });
    const latencyMs = Date.now() - startedAt;

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use",
    );
    if (!toolUse) {
      throw new Error(`structured() call for stage "${stage}" returned no tool_use block`);
    }

    const candidate = wrapped
      ? (toolUse.input as { result: unknown }).result
      : toolUse.input;
    const parsed = schema.safeParse(candidate);

    await logCall({
      runId,
      stage,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    });

    return parsed;
  };

  const first = await attempt(user);
  if (first.success) {
    return first.data;
  }

  const retryMessage = `${user}\n\nYour previous response failed schema validation with this error:\n${first.error.message}\n\nReturn corrected output matching the schema exactly.`;
  const second = await attempt(retryMessage);
  if (second.success) {
    return second.data;
  }

  throw new Error(
    `structured() failed after retry for stage "${stage}": ${second.error.message}`,
  );
}
