export function generateCandidates(text: string) {
  // Split by anything that isn't a letter or number
  const words = text.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 2)
  const candidateWords = Array.from(new Set(words))

  // n-gram for phrases (e.g., 2 to 4 words)
  const candidatePhrases: string[] = []
  // Clean tokens for phrase matching: keep only alphanumeric and internal hyphens/apostrophes
  const tokens = text.split(/\s+/).map(t => t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")).filter(t => t.length > 0)
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 2; n <= 4 && i + n <= tokens.length; n++) {
      candidatePhrases.push(tokens.slice(i, i + n).join(" "))
    }
  }

  return { candidateWords, candidatePhrases }
}
