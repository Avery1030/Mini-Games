import { downloadBlob, stemFilename } from '../download'
import { htmlToPlainText, sanitizeWriterHtml } from './sanitize'

function walkBlocks(html: string): Array<{ text: string; heading: 0 | 1 | 2; bold: boolean; color?: string }> {
  if (typeof DOMParser === 'undefined') return [{ text: htmlToPlainText(html), heading: 0, bold: false }]
  const doc = new DOMParser().parseFromString(sanitizeWriterHtml(html), 'text/html')
  const blocks: Array<{ text: string; heading: 0 | 1 | 2; bold: boolean; color?: string }> = []

  const push = (el: HTMLElement, heading: 0 | 1 | 2) => {
    const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    if (!text) return
    const bold = Boolean(el.closest('b,strong') || el.querySelector('b,strong'))
    const colored = el.querySelector('font,span')
    const color =
      el.getAttribute('color') ||
      el.style.color ||
      colored?.getAttribute('color') ||
      (colored instanceof HTMLElement ? colored.style.color : '') ||
      undefined
    blocks.push({ text, heading, bold, color })
  }

  const visit = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toUpperCase()
    if (tag === 'H1') {
      push(el, 1)
      return
    }
    if (tag === 'H2' || tag === 'H3') {
      push(el, 2)
      return
    }
    if (tag === 'LI') {
      const before = blocks.length
      push(el, 0)
      if (blocks.length > before) {
        const last = blocks[blocks.length - 1]
        blocks[blocks.length - 1] = { ...last, text: `• ${last.text}` }
      }
      return
    }
    if (tag === 'P' || tag === 'DIV') {
      if (!el.querySelector('p,h1,h2,h3,li,div')) push(el, 0)
      else Array.from(el.childNodes).forEach(visit)
      return
    }
    Array.from(el.childNodes).forEach(visit)
  }

  Array.from(doc.body.childNodes).forEach(visit)
  return blocks.length ? blocks : [{ text: htmlToPlainText(html), heading: 0, bold: false }]
}

function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function wordColor(raw?: string): Nullable<string> {
  if (!raw) return null
  const v = raw.trim()
  if (v.startsWith('#')) {
    const hex = v.slice(1).replace(/[^0-9a-fA-F]/g, '')
    if (hex.length === 3) return hex.split('').map((c) => c + c).join('')
    return hex.slice(0, 6).padEnd(6, '0') || null
  }
  const rgb = v.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!rgb) return null
  return [rgb[1], rgb[2], rgb[3]]
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function crc32(data: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

/** 无压缩 ZIP（Word 可打开的 OOXML 容器） */
function zipStore(files: Array<{ path: string; xml: string }>): Blob {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = enc.encode(file.path)
    const data = enc.encode(file.xml)
    const crc = crc32(data)
    const local = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ])
    const central = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralDir = concatBytes(centrals)
  const eocd = concatBytes([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  const packed = concatBytes([...locals, centralDir, eocd])
  const copy = new ArrayBuffer(packed.byteLength)
  new Uint8Array(copy).set(packed)
  return new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function paragraphXml(block: { text: string; heading: 0 | 1 | 2; bold: boolean; color?: string }): string {
  const style = block.heading === 1 ? 'Heading1' : block.heading === 2 ? 'Heading2' : 'Normal'
  const size = block.heading === 1 ? 36 : block.heading === 2 ? 28 : 22
  const color = wordColor(block.color)
  const rPr = [
    block.bold || block.heading > 0 ? '<w:b/>' : '',
    color ? `<w:color w:val="${color}"/>` : '',
    `<w:sz w:val="${size}"/>`,
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/>',
  ].join('')
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlText(block.text)}</w:t></w:r></w:p>`
}

export function exportWriterTxt(html: string, name: string): void {
  const text = htmlToPlainText(sanitizeWriterHtml(html))
  downloadBlob(new Blob([text || ''], { type: 'text/plain;charset=utf-8' }), `${stemFilename(name)}.txt`)
}

export function exportWriterDocx(html: string, name: string): void {
  const blocks = walkBlocks(html)
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.map(paragraphXml).join('')}</w:body></w:document>`
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
</w:styles>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  const blob = zipStore([
    { path: '[Content_Types].xml', xml: contentTypes },
    { path: '_rels/.rels', xml: rels },
    { path: 'word/document.xml', xml: documentXml },
    { path: 'word/_rels/document.xml.rels', xml: docRels },
    { path: 'word/styles.xml', xml: stylesXml },
  ])
  downloadBlob(blob, `${stemFilename(name)}.docx`)
}

export async function exportWriterPdf(html: string, name: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default
  const host = document.createElement('div')
  host.setAttribute('data-office-print', '1')
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:720px;padding:28px;background:#fff;color:#111;font-family:Times New Roman,serif;font-size:14px;line-height:1.5;'
  host.innerHTML = sanitizeWriterHtml(html)
  document.body.appendChild(host)
  try {
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 36
    const imgW = pageW - margin * 2
    const imgH = (canvas.height * imgW) / canvas.width
    const img = canvas.toDataURL('image/png')
    let heightLeft = imgH
    let y = margin
    pdf.addImage(img, 'PNG', margin, y, imgW, imgH)
    heightLeft -= pageH - margin * 2
    while (heightLeft > 0) {
      y = margin - (imgH - heightLeft)
      pdf.addPage()
      pdf.addImage(img, 'PNG', margin, y, imgW, imgH)
      heightLeft -= pageH - margin * 2
    }
    pdf.save(`${stemFilename(name)}.pdf`)
  } finally {
    host.remove()
  }
}
