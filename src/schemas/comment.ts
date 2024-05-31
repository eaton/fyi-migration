import { z } from 'zod';

export const authorSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  mail: z.string().optional(),
})

export const commentSchema = z.object({
  id: z.string().describe('A unique identifier for the comment; it should be generated consistently with other comments in the same thread.'),
  parent: z.string().optional().describe('An entry ID or a URL the comment was posted in reply to.'),
  sort: z.string().optional().describe("A sortable representation of the comment's position in the thread."),
  about: z.string().describe('An entry ID or a URL the comment was posted in reply to.'),
  date: z.date(),
  author: authorSchema.optional(),
  subject: z.string().optional(),
  body: z.string(),
});

export type Author = z.infer<typeof authorSchema>;
export type Comment = z.infer<typeof commentSchema>;