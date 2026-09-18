function num(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

interface Pricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Picks the price tier by matching against MODEL_STRONG/MODEL_FAST; unknown models fall back to strong pricing. */
export function priceForModel(model: string): Pricing {
  const isFast = model === process.env.MODEL_FAST;
  if (isFast) {
    return {
      inputPerMillion: num(process.env.PRICE_FAST_INPUT, 1),
      outputPerMillion: num(process.env.PRICE_FAST_OUTPUT, 5),
    };
  }
  return {
    inputPerMillion: num(process.env.PRICE_STRONG_INPUT, 3),
    outputPerMillion: num(process.env.PRICE_STRONG_OUTPUT, 15),
  };
}

export function costInr(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const { inputPerMillion, outputPerMillion } = priceForModel(model);
  const usd =
    (inputTokens / 1_000_000) * inputPerMillion +
    (outputTokens / 1_000_000) * outputPerMillion;
  return usd * num(process.env.USD_INR, 84);
}
