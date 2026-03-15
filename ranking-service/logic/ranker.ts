import { computeTextScore, parseQuery, correctTokens, CorrectionResult } from "./fuzzy";
import { computeContextScore, SearchContext } from "./contextMatch";
import { details, usageRules } from "../data/details";

export interface RankedResult {
  detail_id: number;
  title: string;
  score: number;
  explanation: string;
}

export interface RankResponse {
  results: RankedResult[];
  searched_for: string | null;
  corrections: Record<string, string> | null;
}

/**
 * Main ranking function.
 * Supports quoted exact tokens ("slab") and unquoted fuzzy tokens.
 * Returns top 5 results sorted by score descending, plus correction info.
 */
export function rankDetails(query: string | undefined, context: SearchContext | undefined): RankResponse {
  const hasQuery = !!(query && query.trim().length > 0);

  const { fuzzyTokens, exactTokens } = hasQuery ? parseQuery(query!) : { fuzzyTokens: [], exactTokens: [] };
  const hasTokens = fuzzyTokens.length > 0 || exactTokens.length > 0;

  let correction: CorrectionResult | null = null;
  if (hasTokens) {
    correction = correctTokens(fuzzyTokens, exactTokens);
  }

  const scored: RankedResult[] = details.map((detail) => {
    const rule = usageRules.find((r) => r.detail_id === detail.id);

    const { score: rawTextScore, matchedTokens } = computeTextScore(detail, fuzzyTokens, exactTokens);
    const { score: rawContextScore, matchedFields } = computeContextScore(rule, context);

    let finalScore = 0;
    if (hasTokens) {
      finalScore = rawTextScore * 2.0 + rawContextScore * 1.0;
    } else {
      finalScore = rawContextScore * 2.0;
    }

    const explanationParts: string[] = [];
    if (matchedTokens.length > 0) {
      explanationParts.push(`Matched [${matchedTokens.join(", ")}] in title/tags/description`);
    }
    if (matchedFields.length > 0) {
      explanationParts.push(matchedFields.join(", ") + " matched");
    }
    if (explanationParts.length === 0) {
      explanationParts.push("No strong match found — returned as partial result");
    }

    return {
      detail_id: detail.id,
      title: detail.title,
      score: Math.round(finalScore * 10) / 10,
      explanation: explanationParts.join("; "),
    };
  });

  const results = scored.sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    results,
    searched_for: correction?.hasCorrections ? correction.searchedFor : null,
    corrections: correction?.hasCorrections ? correction.corrections : null,
  };
}
