import { normalizeArabic } from "./content-policy";

/**
 * Generates word shingles (k-grams) for an Arabic text.
 */
export function getWordShingles(text: string, k = 2): Set<string> {
  const words = normalizeArabic(text).split(/\s+/).filter((w) => w.length > 1);
  const shingles = new Set<string>();
  if (words.length < k) {
    if (words.length > 0) shingles.add(words.join(" "));
    return shingles;
  }
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

/**
 * Computes exact Jaccard similarity between two sets of shingles.
 */
export function jaccardSimilarity<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Fast MinHash signature generation (simulating 64 hash functions)
 * for large-scale similarity queries and deduplication without heavy dependencies.
 */
export class ArabicMinHasher {
  private readonly numPerm: number;
  private readonly coefficientsA: number[];
  private readonly coefficientsB: number[];
  private readonly prime = 2147483647; // 2^31 - 1

  constructor(numPerm = 64, seed = 42) {
    this.numPerm = numPerm;
    this.coefficientsA = [];
    this.coefficientsB = [];

    // Simple deterministic pseudo-random generator
    let state = seed;
    const nextRandom = () => {
      state = (state * 16807) % 2147483647;
      return state;
    };

    for (let i = 0; i < numPerm; i++) {
      this.coefficientsA.push(1 + (nextRandom() % 1000000));
      this.coefficientsB.push(nextRandom() % 1000000);
    }
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  public computeSignature(text: string, k = 2): number[] {
    const shingles = getWordShingles(text, k);
    const signature = new Array<number>(this.numPerm).fill(Infinity);

    if (shingles.size === 0) return signature;

    for (const shingle of shingles) {
      const h = this.hashString(shingle);
      for (let i = 0; i < this.numPerm; i++) {
        const permHash = (this.coefficientsA[i] * h + this.coefficientsB[i]) % this.prime;
        if (permHash < signature[i]) {
          signature[i] = permHash;
        }
      }
    }

    return signature;
  }

  public estimateSimilarity(sigA: number[], sigB: number[]): number {
    if (sigA.length !== sigB.length || sigA.length === 0) return 0;
    let matches = 0;
    for (let i = 0; i < sigA.length; i++) {
      if (sigA[i] === sigB[i] && sigA[i] !== Infinity) {
        matches++;
      }
    }
    return matches / sigA.length;
  }
}

/**
 * Checks if a candidate article or text is a near-duplicate of an existing story.
 * Returns true if similarity exceeds threshold (default 0.70).
 */
export function isNearDuplicate(
  textA: string,
  textB: string,
  threshold = 0.70
): { isDuplicate: boolean; similarity: number } {
  const shinglesA = getWordShingles(textA, 2);
  const shinglesB = getWordShingles(textB, 2);
  const sim = jaccardSimilarity(shinglesA, shinglesB);
  return {
    isDuplicate: sim >= threshold,
    similarity: Math.round(sim * 100) / 100,
  };
}
