import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';

export const AuthorSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  mail: z.string().optional(),
});

export const CommentSchema = CreativeWorkSchema.extend({
  type: z.string().default('Comment'),
  parent: z
    .string()
    .optional()
    .describe('An entry ID or a URL the comment was posted in reply to.'),
  sort: z
    .string()
    .optional()
    .describe(
      "A sortable representation of the comment's position in the thread.",
    ),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  commenter: AuthorSchema.optional(),
});

export type Author = z.infer<typeof AuthorSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type CommentInput = typeof CommentSchema._input;
