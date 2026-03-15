import { UsageRule } from "../data/details";

export interface SearchContext {
  host_element?: string;
  adjacent_element?: string;
  exposure?: string;
}

export interface ContextScoreResult {
  score: number;
  matchedFields: string[];
}

/**
 * Computes context score for one detail against request context fields.
 *
 * Scoring:
 *   host_element     → +3  (most specific)
 *   adjacent_element → +2
 *   exposure         → +1
 *
 * Case-insensitive comparison.
 */
export function computeContextScore(
  rule: UsageRule | undefined,
  context: SearchContext | undefined
): ContextScoreResult {
  if (!context || !rule) return { score: 0, matchedFields: [] };

  let score = 0;
  const matchedFields: string[] = [];

  const normalize = (str: string | undefined): string => (str || "").trim().toLowerCase();

  if (context.host_element && normalize(rule.host_element) === normalize(context.host_element)) {
    score += 3;
    matchedFields.push(`host_element=${context.host_element}`);
  }

  if (context.adjacent_element && normalize(rule.adjacent_element) === normalize(context.adjacent_element)) {
    score += 2;
    matchedFields.push(`adjacent_element=${context.adjacent_element}`);
  }

  if (context.exposure && normalize(rule.exposure) === normalize(context.exposure)) {
    score += 1;
    matchedFields.push(`exposure=${context.exposure}`);
  }

  return { score, matchedFields };
}
