import { z } from 'zod'

export const NotepadPersistSchema = z.object({
  lastNoteId: z.string().nullable().optional(),
  wordWrap: z.boolean().optional(),
})

export type NotepadPersist = z.infer<typeof NotepadPersistSchema>
