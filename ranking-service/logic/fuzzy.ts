import { Detail, details } from "../data/details";

export interface TextScoreResult {
  score: number;
  matchedTokens: string[];
}

export interface ParsedQuery {
  fuzzyTokens: string[];
  exactTokens: string[];
}

export interface CorrectionResult {
  corrections: Record<string, string>;
  searchedFor: string;
  hasCorrections: boolean;
}

/**
 * Parses a query string, separating quoted phrases (exact match)
 * from unquoted words (fuzzy match).
 *
 * Example: `"slab" waterproofing wndow` →
 *   exactTokens: ["slab"]
 *   fuzzyTokens: ["waterproofing", "wndow"]
 */
export function parseQuery(raw: string): ParsedQuery {
  const exactTokens: string[] = [];
  const quotedPattern = /"([^"]+)"/g;

  let match: RegExpExecArray | null;
  while ((match = quotedPattern.exec(raw)) !== null) {
    const words = tokenize(match[1]);
    exactTokens.push(...words);
  }

  const withoutQuoted = raw.replace(quotedPattern, " ");
  const fuzzyTokens = tokenize(withoutQuoted);

  return { fuzzyTokens, exactTokens };
}

/**
 * Computes Levenshtein distance between two strings.
 * Measures minimum edits (insert, delete, substitute) to transform a → b.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Given a query token and a list of words from a field,
 * returns the best (lowest) levenshtein distance found.
 */
function bestDistance(token: string, fieldWords: string[]): number {
  let best = Infinity;
  for (const word of fieldWords) {
    const dist = levenshtein(token, word);
    if (dist < best) best = dist;
  }
  return best;
}

/**
 * Converts a levenshtein distance into a score.
 * distance 0 → 3 (exact), 1 → 2, 2 → 1, >2 → 0
 */
function distanceToScore(distance: number): number {
  if (distance === 0) return 3;
  if (distance === 1) return 2;
  if (distance === 2) return 1;
  return 0;
}

/**
 * Tokenizes a string into lowercase words, stripping punctuation.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Scores a single token against a detail's fields.
 * If exact=true, only distance 0 counts (no fuzzy tolerance).
 */
function scoreToken(
  token: string,
  titleWords: string[],
  tagWords: string[],
  descWords: string[],
  exact: boolean
): number {
  const titleDist = bestDistance(token, titleWords);
  const tagDist = bestDistance(token, tagWords);
  const descDist = bestDistance(token, descWords);

  const scoreFn = exact ? exactDistanceToScore : distanceToScore;

  const titleScore = scoreFn(titleDist) * 1.5;
  const tagScore = scoreFn(tagDist) * 1.2;
  const descScore = scoreFn(descDist) * 1.0;

  return Math.max(titleScore, tagScore, descScore);
}

/**
 * For exact tokens: only distance 0 scores, everything else is 0.
 */
function exactDistanceToScore(distance: number): number {
  return distance === 0 ? 3 : 0;
}

/**
 * Computes text score for one detail against parsed query tokens.
 *
 * fuzzyTokens  — matched with Levenshtein tolerance (distance 0–2)
 * exactTokens  — quoted by user, must match exactly (distance 0 only)
 */
export function computeTextScore(
  detail: Detail,
  fuzzyTokens: string[],
  exactTokens: string[] = []
): TextScoreResult {
  const allEmpty = fuzzyTokens.length === 0 && exactTokens.length === 0;
  if (allEmpty) return { score: 0, matchedTokens: [] };

  const titleWords = tokenize(detail.title);
  const tagWords = detail.tags.map((t) => t.toLowerCase());
  const descWords = tokenize(detail.description);

  let totalScore = 0;
  const matchedTokens: string[] = [];

  for (const token of fuzzyTokens) {
    const best = scoreToken(token, titleWords, tagWords, descWords, false);
    if (best > 0) {
      totalScore += best;
      matchedTokens.push(token);
    }
  }

  for (const token of exactTokens) {
    const best = scoreToken(token, titleWords, tagWords, descWords, true);
    if (best > 0) {
      totalScore += best;
      matchedTokens.push(`"${token}"`);
    }
  }

  return { score: totalScore, matchedTokens };
}

/**
 * Builds a deduplicated global vocabulary from all details'
 * titles, tags, and descriptions.
 */
function buildVocabulary(): string[] {
  const wordSet = new Set<string>();

  for (const detail of details) {
    for (const w of tokenize(detail.title)) wordSet.add(w);
    for (const t of detail.tags) wordSet.add(t.toLowerCase());
    for (const w of tokenize(detail.description)) wordSet.add(w);
  }

  return Array.from(wordSet);
}

const globalVocabulary = buildVocabulary();

/**
 * For each fuzzy token, finds the closest word in the global vocabulary.
 * Returns a map of typo → corrected word (only for tokens with distance > 0),
 * plus a reconstructed "searched for" string.
 */
export function correctTokens(fuzzyTokens: string[], exactTokens: string[]): CorrectionResult {
  const corrections: Record<string, string> = {};

  const correctedParts: string[] = [];

  for (const token of fuzzyTokens) {
    let bestWord = token;
    let bestDist = Infinity;

    for (const word of globalVocabulary) {
      const dist = levenshtein(token, word);
      if (dist < bestDist) {
        bestDist = dist;
        bestWord = word;
      }
    }

    if (bestDist > 0 && bestDist <= 2) {
      corrections[token] = bestWord;
      correctedParts.push(bestWord);
    } else {
      correctedParts.push(token);
    }
  }

  for (const token of exactTokens) {
    correctedParts.push(`"${token}"`);
  }

  return {
    corrections,
    searchedFor: correctedParts.join(" "),
    hasCorrections: Object.keys(corrections).length > 0,
  };
}
