<script lang="ts">
  import { db } from "./db"
  import { StarDictParser } from "./lib/stardict"
  import { onMount } from "svelte"

  let status = ""
  let stats = {
    knownWords: 0,
    knownPhrases: 0,
    dictEntries: 0,
    dictName: "None",
    learnWords: 0
  }

  onMount(function() {
    loadStats()
  })

  async function loadStats() {
    const kw = await db.known_words.count()
    const kp = await db.known_phrases.count()
    const de = await db.dict_index.count()
    const lw = await db.unknown_words.count()
    const meta = await db.dict_metadata.get('bookname')
    
    stats = {
      knownWords: kw,
      knownPhrases: kp,
      dictEntries: de,
      dictName: meta ? meta.value : "None",
      learnWords: lw
    }
  }

  async function handleFileImport(event: Event, type: 'known_words' | 'known_phrases') {
    const target = event.target as HTMLInputElement
    const file = target.files ? target.files[0] : null
    if (!file) return

    status = "Importing..."
    const text = await file.text()
    const lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; })
    
    const entries = lines.map(function(line) { return { id: line.toLowerCase() }; })

    await db.transaction('rw', [type], async function() {
      await db[type].bulkPut(entries)
    })
    
    status = "Imported " + lines.length + " items."
    await loadStats()
  }

  async function handleDictImport(event: Event) {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files) return

    let ifoFile, idxFile, dictFile
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.name.endsWith('.ifo')) ifoFile = f
      if (f.name.endsWith('.idx')) idxFile = f
      if (f.name.endsWith('.dict')) dictFile = f
    }

    if (!ifoFile || !idxFile || !dictFile) {
      status = "Error: Need .ifo, .idx, and .dict files"
      return
    }

    status = "Parsing..."
    try {
      const ifoText = await ifoFile.text()
      const ifo = StarDictParser.parseIfo(ifoText)
      const idxBuffer = await idxFile.arrayBuffer()
      
      const indexEntries = []
      for (const entry of StarDictParser.parseIdx(idxBuffer)) {
        indexEntries.push(entry)
      }

      status = "Storing " + indexEntries.length + " entries..."
      await db.transaction('rw', ['dict_index', 'dict_metadata'], async function() {
        await db.dict_index.clear()
        await db.dict_index.bulkAdd(indexEntries)
        await db.dict_metadata.put({ key: 'bookname', value: ifo.bookname })
        await db.dict_metadata.put({ key: 'sametypesequence', value: ifo.sametypesequence || 't' })
        await db.dict_metadata.put({ key: 'dict_blob', value: dictFile as any })
      })

      status = "Success!"
      await loadStats()
    } catch (e: any) {
      status = "Failed: " + e.message
    }
  }

  async function resetData() {
    if (!confirm("Clear all data?")) return
    await Promise.all([
      db.known_words.clear(),
      db.unknown_words.clear(),
      db.known_phrases.clear(),
      db.unknown_phrases.clear(),
      db.dict_index.clear(),
      db.dict_metadata.clear(),
      db.phrase_variants.clear()
    ])
    status = "Cleared"
    await loadStats()
  }

  async function exportKnownWords() {
    const words = await db.known_words.toArray()
    const content = words.map(function(w) { return w.id; }).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'known_words.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportKnownPhrases() {
    const items = await db.known_phrases.toArray()
    const content = items.map(function(p) { return p.id; }).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'known_phrases.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportLearningList() {
    const items = await db.unknown_words.toArray()
    if (items.length === 0) {
      alert("No words to export.")
      return
    }
    status = "Preparing learning list..."
    const content = items.map(function(item) { return item.id; }).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learning_list.txt'
    a.click()
    URL.revokeObjectURL(url)
    status = "Exported " + items.length + " words."
  }

  // --- Speech Settings ---
  let speechRate = 1.0
  let selectedVoiceName = ""
  let availableVoices: SpeechSynthesisVoice[] = []

  function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return

    // Filter for English voices (case-insensitive)
    const enVoices = voices.filter(v => 
      v.lang.toLowerCase().startsWith('en')
    )
    
    // Fallback: if no English voices found, show all available voices
    // This handles cases where language tags might be non-standard
    availableVoices = enVoices.length > 0 ? enVoices : voices
  }

  onMount(function() {
    loadStats()
    
    // Load voices immediately
    loadVoices()
    
    // Set up listener for voice changes (async loading)
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
    
    // Fallback timer for some browsers (like Firefox on Linux) 
    // where onvoiceschanged might not fire reliably
    const voiceRetryInterval = setInterval(() => {
      if (availableVoices.length > 0) {
        clearInterval(voiceRetryInterval)
      } else {
        loadVoices()
      }
    }, 1000)
    
    chrome.storage.local.get(["speechRate", "selectedVoiceName"], (res) => {
      if (res.speechRate !== undefined) speechRate = res.speechRate
      if (res.selectedVoiceName) selectedVoiceName = res.selectedVoiceName
    })

    return () => {
      clearInterval(voiceRetryInterval)
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  })

  function handleRateChange(e: Event) {
    const target = e.target as HTMLInputElement
    speechRate = parseFloat(target.value)
    chrome.storage.local.set({ speechRate })
  }

  function handleVoiceChange(e: Event) {
    const target = e.target as HTMLSelectElement
    selectedVoiceName = target.value
    chrome.storage.local.set({ selectedVoiceName })
  }

  function speakTest() {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance("This is a test of the vocabulary helper speech system.")
    
    // Set a default lang, but voice might override it
    utterance.lang = "en-US"

    if (selectedVoiceName) {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.name === selectedVoiceName)
      if (voice) {
        utterance.voice = voice
        if (voice.lang) utterance.lang = voice.lang
      }
    }
    
    utterance.rate = speechRate
    window.speechSynthesis.speak(utterance)
  }
</script>

<main>
  <header>
    <h1>Vocabulary Helper <small>v1.0.0</small></h1>
  </header>

  <div class="layout">
    <div class="content">
      <section class="card">
        <h2>📊 Current Status</h2>
        <div class="stats-row">
          <div><strong>Dictionary:</strong> {stats.dictName}</div>
          <div><strong>Words Index:</strong> {stats.dictEntries}</div>
          <div><strong>Known Words:</strong> {stats.knownWords}</div>
          <div><strong>Words to Learn:</strong> {stats.learnWords}</div>
        </div>
        <div class="actions-row">
          <button class="btn-secondary" on:click={exportKnownWords}>Export Known Words</button>
          <button class="btn-secondary" on:click={exportKnownPhrases}>Export Known Phrases</button>
          <button class="btn-anki" on:click={exportLearningList}>Export Learning List</button>
          <button class="btn-danger" on:click={resetData}>Reset All</button>
        </div>
      </section>

      <section class="card">
        <h2>🔊 Speech Settings</h2>
        <div class="field">
          <label>Voice (British/American, Male/Female)</label>
          <div class="voice-row">
            <select value={selectedVoiceName} on:change={handleVoiceChange}>
              <option value="">Default System Voice</option>
              {#each availableVoices as voice}
                <option value={voice.name}>{voice.name} ({voice.lang})</option>
              {/each}
            </select>
            <button class="btn-test" on:click={speakTest} title="Test Voice">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </button>
          </div>
          <p class="hint">Available voices depend on your operating system.</p>
        </div>
        <div class="field">
          <label>Speed: {speechRate.toFixed(1)}x</label>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={speechRate} 
            on:input={handleRateChange} 
          />
        </div>
      </section>

      <section class="card">
        <h2>📥 Import Data</h2>
        <div class="field">
          <label>StarDict Dictionary (.ifo + .idx + .dict)</label>
          <input type="file" multiple on:change={handleDictImport} />
        </div>
        <div class="import-grid">
          <div class="field">
            <label>Known Words (.txt)</label>
            <input type="file" on:change={(e) => handleFileImport(e, 'known_words')} />
          </div>
          <div class="field">
            <label>Known Phrases (.txt)</label>
            <input type="file" on:change={(e) => handleFileImport(e, 'known_phrases')} />
          </div>
        </div>
        {#if status}<div class="status">{status}</div>{/if}
      </section>
    </div>

    <aside class="guide">
      <section class="card help">
        <h2>💡 Quick Guide</h2>
        <div class="lang-block">
          <h3>English</h3>
          <ol>
            <li><strong>Import Dict:</strong> Upload your StarDict files first.</li>
            <li><strong>Known Words:</strong> Upload your .txt word list to filter out common words.</li>
            <li><strong>Analyze:</strong> Click the red <strong>Analyze</strong> button on any English page.</li>
            <li><strong>Study:</strong> Mark words as <strong>Learn</strong> during reading, then use <strong>Export for Anki</strong> to study them.</li>
          </ol>
        </div>
        <hr />
        <div class="lang-block">
          <h3>中文指南</h3>
          <ol>
            <li><strong>导入词典：</strong> 首先上传 StarDict 格式的词典。</li>
            <li><strong>配置词汇：</strong> 上传您的已掌握单词表（.txt），否则所有词典中的词都会被高亮。</li>
            <li><strong>阅读分析：</strong> 点击右下角红色的 <strong>Analyze</strong> 按钮。</li>
            <li><strong>学习导出：</strong> 在阅读时将生词标记为 <strong>Learn</strong>，之后点击 <strong>Export for Anki</strong> 导出。</li>
          </ol>
        </div>
      </section>
    </aside>
  </div>
</main>

<style>
  :global(body) { background: #f4f7f6; margin: 0; font-family: -apple-system, system-ui, sans-serif; }
  main { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
  header { margin-bottom: 30px; border-bottom: 2px solid #e0e6ed; padding-bottom: 10px; }
  h1 { margin: 0; color: #2c3e50; }
  small { font-size: 0.5em; color: #7f8c8d; vertical-align: middle; }
  h2 { font-size: 1.1rem; margin-top: 0; color: #34495e; }
  h3 { font-size: 0.9rem; margin-bottom: 5px; color: #2980b9; }
  
  .layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
  .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
  
  .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; color: #57606f; font-size: 0.95rem; }
  .actions-row { display: flex; gap: 8px; flex-wrap: wrap; }
  
  .import-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 20px; }
  label { display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.85rem; color: #4b6584; }
  input[type="file"] { width: 100%; font-size: 0.85rem; }
  
  .status { padding: 10px; background: #ebf5ff; color: #2980b9; border-radius: 6px; font-size: 0.85rem; }
  
  .hint { font-size: 0.75rem; color: #7f8c8d; margin-top: 4px; }
  .voice-row { display: flex; gap: 10px; align-items: center; }
  select { flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #dcdde1; font-size: 0.85rem; background: white; }
  .btn-test { background: #3498db; color: white; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
  
  .guide { font-size: 0.9rem; }
  .guide ol { padding-left: 20px; color: #57606f; line-height: 1.6; }
  .help { background: #fff9db; border: 1px solid #ffe066; }
  hr { border: 0; border-top: 1px solid #ffe066; margin: 15px 0; }

  button { padding: 8px 14px; border-radius: 6px; cursor: pointer; border: none; font-size: 0.85rem; transition: filter 0.2s; }
  .btn-secondary { background: #a5b1c2; color: white; }
  .btn-anki { background: #686de0; color: white; }
  .btn-danger { background: #eb4d4b; color: white; }
  button:hover { filter: brightness(0.9); }

  @media (max-width: 768px) {
    .layout { grid-template-columns: 1fr; }
  }
</style>
