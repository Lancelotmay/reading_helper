/**
 * StarDict Parser Utility
 * Supports .ifo, .idx, and .dict files
 */

export interface StarDictIfo {
  bookname: string
  wordcount: number
  idxfilesize: number
  sametypesequence: string
}

export class StarDictParser {
  static parseIfo(content: string): StarDictIfo {
    const lines = content.split('\n')
    const info: any = {}
    lines.forEach(line => {
      const parts = line.split('=')
      if (parts.length === 2) {
        info[parts[0].trim()] = parts[1].trim()
      }
    })
    return info as StarDictIfo
  }

  /**
   * Parse .idx file
   * Note: This handles standard 32-bit offsets. 
   * @param buffer ArrayBuffer of the .idx file
   */
  static *parseIdx(buffer: ArrayBuffer): Generator<{ word: string, offset: number, size: number }> {
    const view = new DataView(buffer)
    const decoder = new TextDecoder()
    let offset = 0

    while (offset < buffer.byteLength) {
      // 1. Read word (null-terminated string)
      let end = offset
      while (view.getUint8(end) !== 0 && end < buffer.byteLength) {
        end++
      }
      const word = decoder.decode(buffer.slice(offset, end))
      offset = end + 1

      // 2. Read word_data_offset (4 bytes, big-endian)
      const dataOffset = view.getUint32(offset)
      offset += 4

      // 3. Read word_data_size (4 bytes, big-endian)
      const dataSize = view.getUint32(offset)
      offset += 4

      yield { word, offset: dataOffset, size: dataSize }
    }
  }

  /**
   * Read definition from .dict file Blob
   */
  static async readDefinition(
    dictBlob: Blob, 
    offset: number, 
    size: number
  ): Promise<string> {
    const slice = dictBlob.slice(offset, offset + size)
    return await slice.text()
  }
}
