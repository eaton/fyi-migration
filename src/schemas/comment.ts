import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';

export const CommentAuthorSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  mail: z.string().optional(),
});

export const CommentSchema = CreativeWorkSchema.extend({
  type: z.string().default('Comment'),
  parent: z
    .coerce
    .string()
    .optional()
    .describe('An entry ID or a URL the comment was posted in reply to.'),
  thread: z
    .string()
    .optional()
    .describe(
      "A sortable representation of the comment's position in the thread.",
    ),
  commenter: CommentAuthorSchema.optional(),
});

export type CommentAuthor = z.infer<typeof CommentAuthorSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type CommentInput = typeof CommentSchema._input;
