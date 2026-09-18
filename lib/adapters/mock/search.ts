import { getDb } from "@/lib/db/client";
import { mockSearchFixtures } from "@/lib/db/schema";
import type { SearchResult } from "@/lib/schemas/searchResult";
import type { SearchProvider } from "../types";

const MIN_RESULTS = 3;
const MAX_RESULTS = 8;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(queryTokens: string[], patternTokens: string[]): number {
  const patternSet = new Set(patternTokens);
  const shared = queryTokens.filter((token) => patternSet.has(token)).length;
  if (shared === 0) {
    return 0;
  }
  return shared / Math.max(patternTokens.length, queryTokens.length);
}

export class MockSearch implements SearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    const db = getDb();
    const fixtures = await db.select().from(mockSearchFixtures);
    const queryTokens = tokenize(query);

    const ranked = fixtures
      .map((fixture) => ({
        fixture,
        score: overlapScore(queryTokens, tokenize(fixture.queryPattern)),
      }))
      .sort((a, b) => b.score - a.score);

    const results: SearchResult[] = [];
    const seenIds = new Set<string>();

    const addFrom = (fixture: (typeof ranked)[number]["fixture"]) => {
      for (const result of fixture.results as SearchResult[]) {
        if (results.length >= MAX_RESULTS) return;
        if (seenIds.has(result.id)) continue;
        seenIds.add(result.id);
        results.push(result);
      }
    };

    for (const { fixture, score } of ranked) {
      if (score <= 0 || results.length >= MAX_RESULTS) break;
      addFrom(fixture);
    }

    if (results.length < MIN_RESULTS) {
      // Fuzzy match came up short — pad with whatever fixtures remain so we always return at least 3.
      for (const { fixture } of ranked) {
        if (results.length >= MIN_RESULTS) break;
        addFrom(fixture);
      }
    }

    return results.slice(0, MAX_RESULTS);
  }
}
