import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';

export const ArticleSchema = CreativeWorkSchema.extend({
  type: z.string().default('Article'),
  section: z.string().optional(),
  pagination: z.string().optional(),
  publisher: z.string().optional(),
});

export type Article = z.infer<typeof ArticleSchema>;
