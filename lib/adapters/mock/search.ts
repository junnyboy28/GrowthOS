import type { SearchResult } from "@/lib/schemas/searchResult";
import type { SearchProvider } from "../types";

/** Implemented in Phase 1: fuzzy-matches mock_search_fixtures by query pattern. */
export class MockSearch implements SearchProvider {
  search(_query: string): Promise<SearchResult[]> {
    throw new Error("not implemented");
  }
}
