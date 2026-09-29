/**
 * What a build cost, from the tokens the provider reported for it.
 *
 * Prices are dollars per million tokens, as of the premium-design-quality plan (2026-09-29): Flash $0.50 in and
 * $3 out, Pro $2 in and $12 out, which is where the plan's "about $0.013 against $0.05 for a build of 9k in and
 * 3k out" comes from. Thinking tokens are billed as output. They change; check the provider's price list before
 * trusting a total, or pass the prices for a run with --price. A model this table does not know has no cost, only
 * tokens, rather than a guess.
 */

export type ModelPrice = { input: number; output: number };

export type Usage = {
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
};

const PRICES: Array<{ match: RegExp; price: ModelPrice | null }> = [
  // Lite models are priced differently from Flash and are not in this table.
  { match: /flash[-_ ]?lite/i, price: null },
  { match: /pro/i, price: { input: 2, output: 12 } },
  { match: /flash/i, price: { input: 0.5, output: 3 } },
];

export function priceOf(model: string): ModelPrice | null {
  return PRICES.find((entry) => entry.match.test(model))?.price ?? null;
}

/** "0.5,3" as the dollars per million input and output tokens of a run. */
export function parsePrice(value: string): ModelPrice {
  const [input, output, ...rest] = value.split(",").map((part) => Number(part.trim()));
  if (rest.length > 0 || ![input, output].every((part) => Number.isFinite(part) && part >= 0)) {
    throw new Error('--price must be two numbers, the dollars per million input and output tokens: "0.5,3".');
  }
  return { input, output };
}

/** Dollars for one build, or null when the tokens or the price are not known. */
export function costOf(usage: Usage, price: ModelPrice | null): number | null {
  if (!price || usage.inputTokens === null || usage.outputTokens === null) return null;
  return (usage.inputTokens * price.input + (usage.outputTokens + (usage.thinkingTokens ?? 0)) * price.output) / 1_000_000;
}

export const formatCost = (value: number | null) => (value === null ? "n/a" : `$${value.toFixed(4)}`);
