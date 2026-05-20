<script lang="ts">
  import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
  import { onMount, tick } from "svelte"

  export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"]
  }

  export const getInlineAnchor: PlasmoGetInlineAnchor = async function() {
    return document.querySelector("body");
  }

  let visible = false
  let term = ""
  let definition = ""
  let x = 0
  let y = 0
  let opacity = 0
  let currentTarget: HTMLElement | null = null
  let canonicalId = ""
  let isPhrase = false
  let status: 'known' | 'learning' | 'none' = 'none'
  let isHtml = false
  $: isHtmlDisplay = isHtml || /<[a-zA-Z\/][^>]*>/.test(definition)
  let speechRate = 1.0
  let selectedVoiceName = ""

  let popupElement: HTMLElement | null = null

  function extractBody(html: string) {
    if (!html) return ""
    // Basic cleaning to remove html/head/body tags if they wrap the entire content
    // This avoids invalid nested structures while keeping dictionary internal tags
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    let content = bodyMatch ? bodyMatch[1] : html
    content = content.replace(/<html[^>]*>|<\/html>|<head[^>]*>[\s\S]*<\/head>/gi, "")
    return content
  }

  async function showPopup(rect: DOMRect | { top: number, bottom: number, left: number, right: number }) {
    // Initial placement to allow measurement
    x = rect.left + window.scrollX
    y = rect.bottom + window.scrollY
    opacity = 0
    visible = true
    
    await tick()
    
    if (popupElement) {
      const popupRect = popupElement.getBoundingClientRect()
      const vh = window.innerHeight
      const vw = window.innerWidth
      
      let newX = rect.left + window.scrollX
      let newY = rect.bottom + window.scrollY + 5 // 5px gap
      
      // Bottom overflow: if popup bottom would be below viewport, show above target
      if (rect.bottom + popupRect.height + 10 > vh) {
        newY = rect.top + window.scrollY - popupRect.height - 5
      }
      
      // Right overflow
      if (rect.left + popupRect.width + 20 > vw) {
        newX = vw - popupRect.width + window.scrollX - 20
      }
      
      // Left/Top safety
      if (newX < window.scrollX + 10) newX = window.scrollX + 10
      if (newY < window.scrollY + 10) newY = window.scrollY + 10
      
      x = newX
      y = newY
      opacity = 1
    }
  }

  onMount(function() {
    // Load saved speech settings
    const loadSettings = () => {
      chrome.storage.local.get(["speechRate", "selectedVoiceName"], (res) => {
        if (res.speechRate !== undefined) speechRate = res.speechRate
        if (res.selectedVoiceName) selectedVoiceName = res.selectedVoiceName
      })
    }
    
    loadSettings()

    // Listen for setting changes from options page
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.speechRate) speechRate = changes.speechRate.newValue
      if (changes.selectedVoiceName) selectedVoiceName = changes.selectedVoiceName.newValue
    }
    chrome.storage.onChanged.addListener(storageListener)

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.classList && target.classList.contains("ext-vocab")) {
        currentTarget = target
        term = target.innerText
        canonicalId = target.dataset.canonicalId || term
        isPhrase = target.dataset.isPhrase === "true"
        definition = target.dataset.shortDef || ""
        isHtml = target.dataset.isHtml === "true"
        status = 'none'
        showPopup(target.getBoundingClientRect())
      }
    }

    function handleGlobalMouseDown(e: MouseEvent) {
      if (!visible) return
      const target = e.target as HTMLElement
      if (target.classList && target.classList.contains("ext-vocab")) return
      if (popupElement && popupElement.contains(target)) return
      visible = false
      opacity = 0
    }

    const messageListener = (msg: any) => {
      if (msg.type === "SHOW_POPUP") {
        term = msg.payload.term
        canonicalId = msg.payload.canonicalId
        definition = msg.payload.shortDef
        isHtml = msg.payload.isHtml
        isPhrase = msg.payload.isPhrase
        status = msg.payload.status
        currentTarget = null
        
        const rect = msg.payload.targetRect || {
          left: msg.payload.x - window.scrollX,
          top: (msg.payload.y - window.scrollY) - 20, // heuristic if missing
          bottom: msg.payload.y - window.scrollY,
          right: msg.payload.x - window.scrollX + 100
        }
        showPopup(rect)
      }
    }

    document.addEventListener("mouseover", handleMouseOver)
    document.addEventListener("mousedown", handleGlobalMouseDown)
    chrome.runtime.onMessage.addListener(messageListener)

    return function() {
      document.removeEventListener("mouseover", handleMouseOver)
      document.removeEventListener("mousedown", handleGlobalMouseDown)
      chrome.storage.onChanged.removeListener(storageListener)
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  })

  async function updateStatus(newStatus: 'known' | 'learning') {
    if (!canonicalId) return
    await chrome.runtime.sendMessage({
      type: "UPDATE_STATUS",
      payload: { id: canonicalId, status: newStatus, isPhrase: isPhrase }
    })
    if (newStatus === 'known' && currentTarget) {
      const textNode = document.createTextNode(currentTarget.textContent || "")
      currentTarget.replaceWith(textNode)
    }
    visible = false
  }

  async function handleToggleKnown() {
    if (status === 'known') {
      await updateStatus('learning') 
    } else {
      await updateStatus('known')
    }
  }

  function handlePopupMouseDown(e: MouseEvent) {
    e.stopPropagation()
  }

  function speak() {
    if (!term) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(term)
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

{#if visible}
  <div 
    bind:this={popupElement}
    class="popup reading-helper-popup" 
    style="top: {y}px; left: {x}px; opacity: {opacity};" 
    on:mousedown={handlePopupMouseDown}
  >
    <div class="header">
      <button class="btn-speak" on:click={speak} title="Listen">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </button>
      <h3>{term}</h3>
    </div>

    {#if canonicalId && canonicalId.toLowerCase() !== term.toLowerCase()}
      <div class="canonical">({canonicalId})</div>
    {/if}
    <div class="def-scroll">
       {#if isHtmlDisplay}
         <div class="raw-html-content">{@html extractBody(definition)}</div>
       {:else}
         <p>{definition}</p>
       {/if}
    </div>
    <div class="actions">
      <button on:click={handleToggleKnown}>
        {status === 'known' ? 'Unknown' : 'Known'}
      </button>
      <button on:click={function() { updateStatus('learning'); }}>
        Learn
      </button>
    </div>
  </div>
{/if}

<style>
  .popup {
    position: absolute; background: white; border: 1px solid #ddd;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1); padding: 16px;
    border-radius: 12px; z-index: 2147483647; min-width: 280px; max-width: 480px;
    font-family: sans-serif; color: #333;
    transition: opacity 0.15s ease-out;
    pointer-events: auto;
  }
  .header { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 10px; }
  h3 { margin: 0; font-size: 18px; font-weight: 700; color: #2c3e50; flex: 1; }
  .btn-speak { 
    background: none; border: none; cursor: pointer; color: #7f8c8d; 
    padding: 0; margin-right: 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
    transition: color 0.2s;
  }
  .btn-speak:hover { color: #3498db; }
  
  .canonical { font-size: 12px; color: #95a5a6; margin-bottom: 10px; font-style: italic; }
  .def-scroll { max-height: 400px; overflow-y: auto; margin-bottom: 16px; }
  p { margin: 0; font-size: 14px; line-height: 1.6; color: #555; white-space: pre-wrap; }

  /* Minimal styling to ensure visibility while respecting original dictionary HTML */
  .raw-html-content { font-size: 14px; line-height: 1.5; color: #333; }
  .raw-html-content :global(a) { color: #3498db; text-decoration: none; }
  .raw-html-content :global(b), .raw-html-content :global(strong) { font-weight: bold; }
  .raw-html-content :global(i), .raw-html-content :global(em) { font-style: italic; }
  
  button {
    font-size: 13px; padding: 7px 16px; cursor: pointer; border-radius: 6px;
    border: 1px solid #dcdde1; font-weight: 500; transition: all 0.2s;
    background: #f1f2f6; color: #2f3542;
  }
  button:hover { background: #dfe4ea; border-color: #ced6e0; }
  button:active { transform: translateY(1px); }
  .actions { display: flex; gap: 12px; justify-content: flex-end; align-items: center; border-top: 1px solid #f0f0f0; padding-top: 12px; }
</style>
