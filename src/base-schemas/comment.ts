import { z } from 'zod';
import { authorSchema } from '../misc/disqus/schema';

export const commentSchema = z.object({
  id: z.string().describe('A unique identifier for the comment; it should be generated consistently with other comments in the same thread.'),
  parent: z.string().optional().describe('An entry ID or a URL the comment was posted in reply to.'),
  about: z.string().describe('An entry ID or a URL the comment was posted in reply to.'),
  date: z.date(),
  subject: z.string().optional(),
  body: z.string(),
  data: z.record(z.unknown()).optional(),
  author: authorSchema.optional(),
});

export type Comment = z.infer<typeof commentSchema>;