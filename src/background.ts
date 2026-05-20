import { db } from "./db"
import { StarDictParser } from "./lib/stardict"

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "ANALYZE_BATCH") {
    handleAnalyzeBatch(message.payload).then(sendResponse)
    return true
  }
  if (message.type === "UPDATE_STATUS") {
    handleUpdateStatus(message.payload)
    return false
  }
  if (message.type === "LOOKUP_WORD") {
    handleLookupWord(message.payload).then(sendResponse)
    return true
  }
  if (message.type === "SHOW_POPUP" && sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, message)
    return false
  }
  return false
})

/**
 * Clean raw definition and detect if it should be rendered as HTML
 */
function processDefinition(raw: string, dictType: string): { def: string, isHtml: boolean } {
  const cleaned = raw.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, "")
  const isHtml = /h|m|g/i.test(dictType) || /<[a-z][\s\S]*>|<br\s*\/?>/i.test(cleaned)
  return { def: cleaned, isHtml }
}

async function handleLookupWord(payload: { term: string }) {
  const dictBlobEntry = await db.dict_metadata.get('dict_blob')
  const typeEntry = await db.dict_metadata.get('sametypesequence')
  const dictBlob = dictBlobEntry ? (dictBlobEntry.value as any) : null
  const dictType = typeEntry ? typeEntry.value : 't'

  if (!dictBlob) return { type: "LOOKUP_RESULT", found: false }

  const term = payload.term.trim()
  if (!term) return { type: "LOOKUP_RESULT", found: false }

  const lowerTerm = term.toLowerCase()
  const lemmas = getLemmas(lowerTerm)
  
  let rawDefinition = ""
  let foundCanonical = ""

  const lookupKeys = Array.from(new Set([lowerTerm, ...lemmas, term]))
  const entries = await db.dict_index.where('word').anyOf(lookupKeys).toArray()
  const indexMap = new Map(entries.map(e => [e.word, e]))

  for (const key of lookupKeys) {
    const index = indexMap.get(key)
    if (index) {
      rawDefinition = await StarDictParser.readDefinition(dictBlob, index.offset, index.size)
      foundCanonical = key
      break
    }
  }

  if (!rawDefinition) return { type: "LOOKUP_RESULT", found: false }

  const { def, isHtml } = processDefinition(rawDefinition, dictType)
  const isKnownWord = await db.known_words.get(foundCanonical)
  const isLearningWord = await db.unknown_words.get(foundCanonical)

  return {
    type: "LOOKUP_RESULT",
    found: true,
    payload: {
      term: term,
      canonicalId: foundCanonical,
      shortDef: def,
      isHtml: isHtml,
      status: isKnownWord ? 'known' : (isLearningWord ? 'learning' : 'none'),
      isPhrase: false
    }
  }
}

async function handleUpdateStatus(payload: any) {
  const id = (payload.id || "").toLowerCase()
  const { status, isPhrase } = payload
  if (!id) return

  if (status === 'known') {
    if (isPhrase) {
      await db.known_phrases.put({ id })
      await db.unknown_phrases.delete(id)
    } else {
      await db.known_words.put({ id })
      await db.unknown_words.delete(id)
    }
  } else if (status === 'learning') {
    if (isPhrase) {
      await db.unknown_phrases.put({ id })
      await db.known_phrases.delete(id)
    } else {
      await db.unknown_words.put({ id })
      await db.known_words.delete(id)
    }
  }
}

function getLemmas(word: string): string[] {
  const lemmas = [word]
  const lower = word.toLowerCase()
  if (lower.endsWith('s')) {
    if (lower.endsWith('ies')) lemmas.push(lower.slice(0, -3) + 'y')
    else if (lower.endsWith('es')) { 
      lemmas.push(lower.slice(0, -2))
      lemmas.push(lower.slice(0, -1))
    }
    else lemmas.push(lower.slice(0, -1))
  }
  if (lower.endsWith('ed')) {
    lemmas.push(lower.slice(0, -2))
    lemmas.push(lower.slice(0, -1))
  }
  if (lower.endsWith('ing')) {
    lemmas.push(lower.slice(0, -3))
    lemmas.push(lower.slice(0, -3) + 'e')
  }
  if (lower.endsWith('ly')) lemmas.push(lower.slice(0, -2))
  return Array.from(new Set(lemmas))
}

async function handleAnalyzeBatch(payload: any[]) {
  const dictBlobEntry = await db.dict_metadata.get('dict_blob')
  const typeEntry = await db.dict_metadata.get('sametypesequence')
  const dictBlob = dictBlobEntry ? (dictBlobEntry.value as any) : null
  const dictType = typeEntry ? typeEntry.value : 't'

  if (!dictBlob) return { type: "ANALYZE_RESULT", payload: [] }

  const [knownWords, knownPhrases, phraseVariants] = await Promise.all([
    db.known_words.toArray().then(arr => new Set(arr.map(w => w.id))),
    db.known_phrases.toArray().then(arr => new Set(arr.map(p => p.id))),
    db.phrase_variants.toArray().then(arr => new Map(arr.map(v => [v.variant, v.canonical_id])))
  ])

  const lookupKeys = new Set<string>()
  for (const block of payload) {
    for (const p of block.candidatePhrases) {
      const lower = p.toLowerCase()
      const canonical = phraseVariants.get(lower) || lower
      if (!knownPhrases.has(canonical)) {
        lookupKeys.add(canonical); lookupKeys.add(p)
        lookupKeys.add(lower.charAt(0).toUpperCase() + lower.slice(1))
      }
    }
    for (const w of block.candidateWords) {
      const lower = w.toLowerCase()
      const lemmas = getLemmas(lower)
      if (!lemmas.some(l => knownWords.has(l))) {
        lemmas.forEach(l => { lookupKeys.add(l); lookupKeys.add(l.charAt(0).toUpperCase() + l.slice(1)) })
        lookupKeys.add(w)
        lookupKeys.add(lower.charAt(0).toUpperCase() + lower.slice(1))
      }
    }
  }

  const entries = await db.dict_index.where('word').anyOf(Array.from(lookupKeys)).toArray()
  const indexMap = new Map(entries.map(e => [e.word, e]))
  const defCache = new Map<string, { def: string, isHtml: boolean }>()

  async function getCachedDefinition(word: string) {
    const lower = word.toLowerCase()
    if (defCache.has(lower)) return defCache.get(lower)
    
    const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1)
    const index = indexMap.get(lower) || indexMap.get(capitalized) || indexMap.get(word)
    
    if (!index) return null
    const rawDef = await StarDictParser.readDefinition(dictBlob, index.offset, index.size)
    const result = processDefinition(rawDef.slice(0, 5000), dictType)
    defCache.set(lower, result)
    return result
  }

  const results = []
  for (const block of payload) {
    const matches = []
    for (const phrase of block.candidatePhrases) {
      const lower = phrase.toLowerCase()
      const canonical = phraseVariants.get(lower) || lower
      if (knownPhrases.has(canonical)) continue
      const res = await getCachedDefinition(canonical)
      if (res) matches.push({ candidate: phrase, canonicalId: canonical, shortDef: res.def, isHtml: res.isHtml, isPhrase: true })
    }

    for (const word of block.candidateWords) {
      const lower = word.toLowerCase()
      if (knownWords.has(lower)) continue
      const lemmas = getLemmas(lower)
      if (lemmas.some(l => knownWords.has(l))) continue

      let res = await getCachedDefinition(lower)
      let foundLemma = lower
      if (!res) {
        for (const l of lemmas) {
          if (l === lower) continue
          res = await getCachedDefinition(l)
          if (res) { foundLemma = l; break }
        }
      }
      if (res) matches.push({ candidate: word, canonicalId: foundLemma, shortDef: res.def, isHtml: res.isHtml, isPhrase: false })
    }
    
    const seen = new Set<string>()
    results.push({ 
      blockId: block.blockId, 
      matches: matches.filter(m => {
        const key = m.candidate.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })
  }
  return { type: "ANALYZE_RESULT", payload: results }
}
