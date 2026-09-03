import { z } from 'zod'

export const OFFICE_HTML_MAX = 400_000
export const OFFICE_CELL_MAX = 4_000
export const SHEET_COLS = 10
export const SHEET_ROWS = 24
export const SHEET_MAX_COLS = 26
export const SHEET_MAX_ROWS = 100

export const WriterBodySchema = z.object({
  html: z.string().max(OFFICE_HTML_MAX),
})

export const SheetBodySchema = z.object({
  cols: z.number().int().min(1).max(SHEET_MAX_COLS),
  rows: z.number().int().min(1).max(SHEET_MAX_ROWS),
  cells: z.record(z.string(), z.string().max(OFFICE_CELL_MAX)),
  /** 列宽（px），缺省按默认列宽 */
  colWidths: z.array(z.number()).max(SHEET_MAX_COLS).optional(),
  /** 行高（px），缺省按默认行高 */
  rowHeights: z.array(z.number()).max(SHEET_MAX_ROWS).optional(),
  rowHeadWidth: z.number().optional(),
  colHeadHeight: z.number().optional(),
})

export const OfficeFileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  kind: z.enum(['writer', 'sheet']),
  updatedAt: z.number(),
  writer: WriterBodySchema.optional(),
  sheet: SheetBodySchema.optional(),
})

export const OfficePersistSchema = z.object({
  files: z.array(OfficeFileSchema).max(200),
  lastWriterId: z.string().nullable(),
  lastSheetId: z.string().nullable(),
})

export type WriterBody = z.infer<typeof WriterBodySchema>
export type SheetBody = z.infer<typeof SheetBodySchema>
export type OfficeFile = z.infer<typeof OfficeFileSchema>
export type OfficeKind = OfficeFile['kind']
export type OfficePersist = z.infer<typeof OfficePersistSchema>

export const EMPTY_WRITER: WriterBody = { html: '<p></p>' }

export const EMPTY_SHEET: SheetBody = {
  cols: SHEET_COLS,
  rows: SHEET_ROWS,
  cells: {},
}

export function parseOfficePersist(raw: unknown): Nullable<OfficePersist> {
  const parsed = OfficePersistSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function colLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

export function cellKey(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`
}
