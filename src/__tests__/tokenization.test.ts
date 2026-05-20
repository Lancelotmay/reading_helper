import { expect, test } from "vitest"
import { generateCandidates } from "../lib/tokenization"

test("generateCandidates handles simple text", () => {
  const text = "He decided to take off his hat."
  const { candidateWords, candidatePhrases } = generateCandidates(text)

  expect(candidateWords).toContain("decided")
  expect(candidateWords).toContain("take")
  expect(candidatePhrases).toContain("take off")
})

test("generateCandidates filters short words", () => {
  const text = "A hat is on."
  const { candidateWords } = generateCandidates(text)
  expect(candidateWords).not.toContain("A")
  expect(candidateWords).not.toContain("is")
  expect(candidateWords).not.toContain("on")
})
