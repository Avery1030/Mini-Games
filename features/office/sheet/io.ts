import { downloadBlob, stemFilename } from '../download'
import {
  OFFICE_CELL_MAX,
  SHEET_COLS,
  SHEET_MAX_COLS,
  SHEET_MAX_ROWS,
  SHEET_ROWS,
  cellKey,
  colLetter,
  type SheetBody,
} from '../schema'
import { unzip, zipStore } from '../zip'
import { isPlainNumber } from './formula'
import { normalizeSheet, sheetSize } from './sheetOps'

function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function utf8(xml: string): Uint8Array {
  return new TextEncoder().encode(xml)
}

function localName(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, '')
}

function descendants(root: ParentNode, name: string): Element[] {
  return Array.from((root as Element).getElementsByTagName('*')).filter((n) => localName(n) === name)
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function parseCsv(text: string, delimiter = ','): string[][] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }
  if (quoted) throw new Error('csv')
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  if (rows.length && rows[rows.length - 1]?.length === 1 && rows[rows.length - 1]![0] === '') rows.pop()
  return rows.length ? rows : [['']]
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

export function toCsv(grid: string[][]): string {
  return grid.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

export function sheetFromGrid(grid: string[][]): SheetBody {
  let cols = SHEET_COLS
  let rows = SHEET_ROWS
  const cells: Record<string, string> = {}
  for (let r = 0; r < grid.length && r < SHEET_MAX_ROWS; r++) {
    const line = grid[r] ?? []
    rows = Math.max(rows, r + 1)
    for (let c = 0; c < line.length && c < SHEET_MAX_COLS; c++) {
      cols = Math.max(cols, c + 1)
      const value = (line[c] ?? '').slice(0, OFFICE_CELL_MAX)
      if (value.trim()) cells[cellKey(c, r)] = value
    }
  }
  return normalizeSheet({ cols, rows, cells })
}

export function gridFromSheet(sheet: SheetBody): string[][] {
  const { cols, rows } = sheetSize(sheet)
  let maxC = 0
  let maxR = 0
  for (const key of Object.keys(sheet.cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(key)
    if (!m) continue
    const col = m[1]!.charCodeAt(0) - 65
    const row = Number(m[2]) - 1
    if (sheet.cells[key]?.trim()) {
      maxC = Math.max(maxC, col)
      maxR = Math.max(maxR, row)
    }
  }
  const w = Math.min(cols, Math.max(1, maxC + 1))
  const h = Math.min(rows, Math.max(1, maxR + 1))
  const grid: string[][] = []
  for (let r = 0; r < h; r++) {
    const row: string[] = []
    for (let c = 0; c < w; c++) row.push(sheet.cells[cellKey(c, r)] ?? '')
    grid.push(row)
  }
  return grid
}

function parseCellRef(ref: string): Nullable<{ col: number; row: number }> {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim())
  if (!m) return null
  const letters = m[1]!.toUpperCase()
  if (letters.length !== 1) return null
  const col = letters.charCodeAt(0) - 65
  const row = Number(m[2]) - 1
  if (col < 0 || col >= SHEET_MAX_COLS || row < 0 || row >= SHEET_MAX_ROWS) return null
  return { col, row }
}

function xlsxCellXml(col: number, row: number, raw: string): string {
  const ref = `${colLetter(col)}${row + 1}`
  if (raw.startsWith('=')) {
    const f = xmlText(raw.slice(1))
    return `<c r="${ref}"><f>${f}</f></c>`
  }
  if (isPlainNumber(raw)) return `<c r="${ref}"><v>${xmlText(raw.trim())}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(raw)}</t></is></c>`
}

export function exportSheetCsv(sheet: SheetBody, name: string): void {
  const csv = toCsv(gridFromSheet(sheet))
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${stemFilename(name)}.csv`)
}

export function exportSheetXlsx(sheet: SheetBody, name: string): void {
  const { cols, rows } = sheetSize(sheet)
  const dim = `A1:${colLetter(Math.max(0, cols - 1))}${rows}`
  const rowXml: string[] = []
  for (let r = 0; r < rows; r++) {
    const cells: string[] = []
    for (let c = 0; c < cols; c++) {
      const raw = sheet.cells[cellKey(c, r)]
      if (!raw) continue
      cells.push(xlsxCellXml(c, r, raw))
    }
    if (!cells.length) continue
    rowXml.push(`<row r="${r + 1}">${cells.join('')}</row>`)
  }
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/><sheetData>${rowXml.join('')}</sheetData></worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  const blob = zipStore(
    [
      { path: '[Content_Types].xml', data: utf8(contentTypes) },
      { path: '_rels/.rels', data: utf8(rels) },
      { path: 'xl/workbook.xml', data: utf8(workbook) },
      { path: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
      { path: 'xl/worksheets/sheet1.xml', data: utf8(sheetXml) },
    ],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  downloadBlob(blob, `${stemFilename(name)}.xlsx`)
}

function sharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return descendants(doc, 'si').map((si) => descendants(si, 't').map((t) => t.textContent ?? '').join(''))
}

function cellText(c: Element, strings: string[]): string {
  const type = c.getAttribute('t') ?? ''
  const formula = descendants(c, 'f')[0]?.textContent?.trim()
  if (formula) return `=${decodeXmlEntities(formula)}`
  if (type === 'inlineStr') return descendants(c, 't').map((t) => t.textContent ?? '').join('')
  const v = descendants(c, 'v')[0]?.textContent ?? ''
  if (type === 's') {
    const i = Number(v)
    return Number.isFinite(i) ? (strings[i] ?? '') : ''
  }
  if (type === 'b') return v === '1' || v.toLowerCase() === 'true' ? 'TRUE' : 'FALSE'
  return v
}

function parseSheetXml(xml: string, strings: string[]): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const grid: string[][] = []
  for (const c of descendants(doc, 'c')) {
    const ref = parseCellRef(c.getAttribute('r') ?? '')
    if (!ref) continue
    const value = cellText(c, strings).slice(0, OFFICE_CELL_MAX)
    if (!value) continue
    while (grid.length <= ref.row) grid.push([])
    const row = grid[ref.row]!
    while (row.length <= ref.col) row.push('')
    row[ref.col] = value
  }
  return grid.length ? grid : [['']]
}

function firstSheetPath(files: Map<string, Uint8Array>): Nullable<string> {
  const relsXml = files.get('xl/_rels/workbook.xml.rels')
  const wbXml = files.get('xl/workbook.xml')
  if (!relsXml || !wbXml) return files.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : null
  const dec = new TextDecoder()
  const relsDoc = new DOMParser().parseFromString(dec.decode(relsXml), 'application/xml')
  const wbDoc = new DOMParser().parseFromString(dec.decode(wbXml), 'application/xml')
  const first = descendants(wbDoc, 'sheet')[0]
  const rid =
    first?.getAttribute('r:id') ||
    first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  if (!rid) return 'xl/worksheets/sheet1.xml'
  const rel = descendants(relsDoc, 'Relationship').find((n) => n.getAttribute('Id') === rid)
  const target = rel?.getAttribute('Target')
  if (!target) return 'xl/worksheets/sheet1.xml'
  const path = target.replace(/^\//, '').replace(/^\.\//, '')
  return path.startsWith('xl/') ? path : `xl/${path}`
}

export async function importSheetFile(file: File): Promise<SheetBody> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'xlsx') {
    const files = await unzip(await file.arrayBuffer())
    const path = firstSheetPath(files)
    const sheetBytes = path ? files.get(path) : null
    if (!sheetBytes) throw new Error('xlsx')
    const dec = new TextDecoder()
    const sst = files.get('xl/sharedStrings.xml')
    const strings = sst ? sharedStrings(dec.decode(sst)) : []
    return sheetFromGrid(parseSheetXml(dec.decode(sheetBytes), strings))
  }
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    const text = await file.text()
    return sheetFromGrid(parseCsv(text, ext === 'tsv' ? '\t' : ','))
  }
  throw new Error('unsupported')
}
