import { MockMetaAds } from "./mock/ads";
import { MockSearch } from "./mock/search";
import type { AdsPlatform, SearchProvider } from "./types";

let adsPlatform: AdsPlatform | undefined;
let searchProvider: SearchProvider | undefined;

export function getAdsPlatform(): AdsPlatform {
  if (!adsPlatform) {
    const provider = process.env.ADS_PROVIDER ?? "mock";
    if (provider !== "mock") {
      throw new Error(`Unknown ADS_PROVIDER: ${provider}`);
    }
    adsPlatform = new MockMetaAds();
  }
  return adsPlatform;
}

export function getSearchProvider(): SearchProvider {
  if (!searchProvider) {
    const provider = process.env.SEARCH_PROVIDER ?? "mock";
    if (provider !== "mock") {
      throw new Error(`Unknown SEARCH_PROVIDER: ${provider}`);
    }
    searchProvider = new MockSearch();
  }
  return searchProvider;
}

export type { AdsPlatform, SearchProvider } from "./types";
