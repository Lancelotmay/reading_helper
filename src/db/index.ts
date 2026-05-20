import Dexie, { type Table } from "dexie"

export interface WordEntry {
  id: string // Canonical word (lowercase)
  short_def?: string
}

export interface PhraseEntry {
  id: string // Canonical phrase (lowercase)
  short_def?: string
}

export interface PhraseVariant {
  variant: string // "takes off", "took off"
  canonical_id: string // "take off"
}

export interface DictIndexEntry {
  word: string
  offset: number
  size: number
}

export interface DictMetadata {
  key: string
  value: string
}

export class ReadingHelperDB extends Dexie {
  // 4 Core Tables
  known_words!: Table<WordEntry>
  unknown_words!: Table<WordEntry>
  known_phrases!: Table<PhraseEntry>
  unknown_phrases!: Table<PhraseEntry>

  // Indexing Tables
  phrase_variants!: Table<PhraseVariant>
  dict_index!: Table<DictIndexEntry>
  dict_metadata!: Table<DictMetadata>

  constructor() {
    super("ReadingHelperDB_V1_2")
    this.version(1).stores({
      known_words: "id",
      unknown_words: "id",
      known_phrases: "id",
      unknown_phrases: "id",
      phrase_variants: "variant, canonical_id",
      dict_index: "word, offset",
      dict_metadata: "key"
    })
  }
}

export const db = new ReadingHelperDB()
