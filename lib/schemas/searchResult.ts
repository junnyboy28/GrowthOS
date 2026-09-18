import { z } from "zod";

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  url: z.string(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;
