import type Anthropic from "@anthropic-ai/sdk";
import type { Business } from "@/lib/db/schema";

/**
 * The business context block, cached with `cache_control` since it is identical
 * across every stage call for a given run. Callers pass this as the first
 * system block and append stage-specific instructions after it (uncached).
 */
export function buildBusinessContext(
  business: Business,
): Anthropic.Messages.TextBlockParam[] {
  const text = [
    `Business: ${business.name}`,
    `Industry: ${business.industry}`,
    `Location: ${business.location}`,
    `Monthly budget: ₹${business.monthlyBudget}`,
    `Brand notes: ${business.brandNotes ?? "none"}`,
  ].join("\n");

  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}
