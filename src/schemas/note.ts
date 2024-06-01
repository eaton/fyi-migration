import { z } from 'zod';

export const NoteSchema = z.object({});
export type Note = z.infer<typeof NoteSchema>;
