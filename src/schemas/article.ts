import { z } from 'zod';

export const ArticleSchema = z.object({});
export type Article = z.infer<typeof ArticleSchema>;
