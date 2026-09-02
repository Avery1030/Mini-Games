import { z } from 'zod'

export const PaintToolSchema = z.enum(['brush', 'eraser', 'line', 'rect', 'ellipse'])

export type PaintTool = z.infer<typeof PaintToolSchema>

export const PaintPersistSchema = z.object({
  lastDrawingId: z.string().nullable().optional(),
  tool: PaintToolSchema.optional(),
  color: z.string().optional(),
  brushSize: z.number().optional(),
})
