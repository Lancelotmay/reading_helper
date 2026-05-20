import { generateCandidates } from "../lib/tokenization"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// --- Types & Interfaces ---

interface TextNodeOffset {
  node: Text
  start: number
  end: number
}

interface MatchResult {
  candidate: string
  canonicalId: string
  shortDef: string
  isPhrase: boolean
  start: number
  end: number
}

// --- Text Content Extraction ---

class TextBlock {
  id: string
  container: HTMLElement
  text: string = ""
  offsetMap: TextNodeOffset[] = []

  constructor(container: HTMLElement) {
    this.id = Math.random().toString(36).substring(7)
    this.container = container
    this.extractText()
  }

  private extractText() {
    const walker = document.createTreeWalker(this.container, NodeFilter.SHOW_TEXT, null)

    let currentOffset = 0
    let node: Node | null
    while ((node = walker.nextNode())) {
      const parent = node.parentElement
      if (!parent) continue
      
      const tag = parent.tagName.toLowerCase()
      const skipTags = ["script", "style", "code", "pre", "button", "input"]
      if (skipTags.includes(tag)) continue

      const textNode = node as Text
      const content = textNode.textContent || ""
      if (content.trim().length === 0) continue
      
      this.text += content
      this.offsetMap.push({ 
        node: textNode, 
        start: currentOffset, 
        end: currentOffset + content.length 
      })
      currentOffset += content.length
    }
  }

  findNodeAtOffset(offset: number): { node: Text; localOffset: number } | null {
    for (const mapping of this.offsetMap) {
      if (offset >= mapping.start && offset < mapping.end) {
        return { node: mapping.node, localOffset: offset - mapping.start }
      }
    }
    return null
  }
}

// --- UI Helpers & Styling ---

function injectGlobalStyle() {
  const styleId = "reading-helper-style"
  if (document.getElementById(styleId)) return
  
  const style = document.createElement("style")
  style.id = styleId
  style.textContent = ".ext-vocab { border-bottom: 2px dotted #ccc; cursor: help; }"
  document.head.appendChild(style)
}

function clearHighlights() {
  const existing = document.querySelectorAll(".ext-vocab")
  existing.forEach(el => {
    const parent = el.parentNode
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    }
  })
}

// --- Main Analysis Logic ---

async function runAnalysis() {
  clearHighlights()
  injectGlobalStyle()
  
  const blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'TD', 'TH', 'BLOCKQUOTE', 'ASIDE', 'MAIN']
  const skipTags = ["script", "style", "code", "pre", "button", "input", "svg", "canvas", "nav", "footer"]
  
  const blockContainers = new Set<HTMLElement>()
  
  // 1. Find all meaningful text nodes and their block parents
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName.toLowerCase()
      if (skipTags.includes(tag) || parent.closest("script, style, code, pre, button, input")) {
        return NodeFilter.FILTER_REJECT
      }
      if (node.textContent?.trim().length === 0) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  let textNode: Node | null
  while ((textNode = walker.nextNode())) {
    let curr = textNode.parentElement
    let blockParent: HTMLElement | null = null
    
    while (curr && curr !== document.body) {
      if (blockTags.includes(curr.tagName)) {
        blockParent = curr
        break
      }
      curr = curr.parentElement
    }
    
    blockContainers.add(blockParent || document.body)
  }

  // 2. Filter containers: if a container is inside another, keep the inner one
  // (e.g., if we have <DIV><P>...</P></DIV>, we want the P)
  const finalContainers = Array.from(blockContainers).filter(c => {
    return !Array.from(blockContainers).some(other => c !== other && c.contains(other))
  })

  // 3. Block Preparation
  const blocks: TextBlock[] = []
  const payload = []

  for (const container of finalContainers) {
    const block = new TextBlock(container)
    if (block.text.trim().length > 3) {
      blocks.push(block)
      const candidates = generateCandidates(block.text)
      payload.push({
        blockId: block.id,
        candidateWords: candidates.candidateWords,
        candidatePhrases: candidates.candidatePhrases
      })
    }
  }

  // 4. Batch Analysis Request
  if (payload.length === 0) return

  const response = await chrome.runtime.sendMessage({ 
    type: "ANALYZE_BATCH", 
    payload 
  })

  if (response?.type === "ANALYZE_RESULT") {
    handleAnalyzeResult(response.payload, blocks)
  }
}

function handleAnalyzeResult(results: any[], blocks: TextBlock[]) {
  for (const result of results) {
    const block = blocks.find(b => b.id === result.blockId)
    if (!block) continue
    
    const matchesWithIndices: MatchResult[] = []
    const lowerText = block.text.toLowerCase()

    for (const match of result.matches) {
      if (!match) continue
      let pos = -1
      const lowerCand = match.candidate.toLowerCase()
      
      while ((pos = lowerText.indexOf(lowerCand, pos + 1)) !== -1) {
        const charBefore = pos > 0 ? lowerText[pos - 1] : ' '
        const charAfter = pos + match.candidate.length < lowerText.length ? lowerText[pos + match.candidate.length] : ' '
        
        const isWordBoundaryBefore = /[^a-zA-Z0-9]/.test(charBefore)
        const isWordBoundaryAfter = /[^a-zA-Z0-9]/.test(charAfter)

        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          matchesWithIndices.push({
            ...match,
            start: pos, 
            end: pos + match.candidate.length 
          })
        }
      }
    }

    matchesWithIndices.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return (b.end - b.start) - (a.end - a.start)
    })

    const filtered: MatchResult[] = []
    let lastEnd = -1
    for (const match of matchesWithIndices) {
      if (match.start >= lastEnd) {
        filtered.push(match)
        lastEnd = match.end
      }
    }
    
    filtered.sort((a, b) => b.start - a.start)
    
    for (const match of filtered) {
      injectHighlight(block, match)
    }
  }
}

function injectHighlight(block: TextBlock, match: MatchResult) {
  const startRes = block.findNodeAtOffset(match.start)
  const endRes = block.findNodeAtOffset(match.end - 1)
  
  if (startRes && endRes && startRes.node === endRes.node && startRes.node.parentElement) {
    const node = startRes.node
    const safeStart = Math.min(startRes.localOffset, node.length)
    const safeEnd = Math.min(startRes.localOffset + match.candidate.length, node.length)
    
    if (safeStart === safeEnd) return

    try {
      const range = document.createRange()
      range.setStart(node, safeStart)
      range.setEnd(node, safeEnd)
      
      const span = document.createElement("span")
      span.className = "ext-vocab"
      span.dataset.canonicalId = match.canonicalId
      span.dataset.isPhrase = String(match.isPhrase)
      span.dataset.shortDef = match.shortDef
      span.dataset.isHtml = String(match.isHtml)
      
      range.surroundContents(span)
    } catch (e) {
      // Silently catch range errors during dynamic DOM changes
    }
  }
}

// --- Floating UI Creation ---

function createTrigger() {
  const btn = document.createElement("button")
  btn.innerText = "A"
  btn.title = "Analyze Page"
  
  Object.assign(btn.style, {
    position: "fixed", 
    bottom: "20px", 
    right: "20px", 
    zIndex: "2147483647",
    width: "42px",
    height: "42px",
    borderRadius: "50%", 
    border: "none",
    background: "#ff6b6b", 
    color: "white", 
    cursor: "pointer", 
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "18px",
    userSelect: "none",
    touchAction: "none",
    transition: "transform 0.1s"
  })

  // Persistence: Load saved position
  chrome.storage.local.get(["btnPosition"], (res) => {
    if (res.btnPosition) {
      btn.style.right = res.btnPosition.right
      btn.style.bottom = res.btnPosition.bottom
    }
  })

  // Dragging logic
  let isDragging = false
  let startX: number, startY: number
  let initialRight: number, initialBottom: number

  const onMouseDown = (e: MouseEvent) => {
    isDragging = false 
    startX = e.clientX
    startY = e.clientY
    
    const rect = btn.getBoundingClientRect()
    initialRight = window.innerWidth - rect.right
    initialBottom = window.innerHeight - rect.bottom

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = startX - moveEvent.clientX
    const deltaY = startY - moveEvent.clientY
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      if (!isDragging) {
        isDragging = true
        btn.style.cursor = "grabbing"
      }
    }
    
    btn.style.right = `${initialRight + deltaX}px`
    btn.style.bottom = `${initialBottom + deltaY}px`
  }

  const onMouseUp = () => {
    btn.style.cursor = "pointer"
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
    
    if (isDragging) {
      chrome.storage.local.set({
        btnPosition: { right: btn.style.right, bottom: btn.style.bottom }
      })
    }
  }

  btn.addEventListener("mousedown", onMouseDown)
  
  btn.onclick = (e) => {
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    btn.style.transform = "scale(0.9)"
    setTimeout(() => btn.style.transform = "scale(1)", 100)
    runAnalysis()
  }
  
  document.body.appendChild(btn)
}

function handleSelection(e: MouseEvent) {
  const selection = window.getSelection()
  if (!selection) return
  
  const text = selection.toString().trim()
  if (text.length > 0 && text.length < 50) {
    // Basic check: don't trigger if clicking on an existing vocab highlight or the popup
    const target = e.target as HTMLElement
    if (target.closest(".ext-vocab") || target.closest(".reading-helper-popup")) return

    chrome.runtime.sendMessage({
      type: "LOOKUP_WORD",
      payload: { term: text }
    }, (response) => {
      if (response && response.found) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        
        chrome.runtime.sendMessage({
          type: "SHOW_POPUP",
          payload: {
            ...response.payload,
            targetRect: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height
            }
          }
        })
      }
    })
  }
}

// --- Initialization ---

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TRIGGER_ANALYSIS") runAnalysis()
})

if (document.readyState === "complete") {
  createTrigger()
} else {
  window.addEventListener("load", createTrigger)
}

document.addEventListener("mouseup", handleSelection)
