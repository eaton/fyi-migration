import { z } from 'zod';

export const jekyllPostSchema = z.object({
  file: z.string().optional(),
  data: z.object({
    title: z.string(),
    layout: z.string().optional(),
    date: z.date().optional(),
    summary: z.string().optional(),
    excerpt: z.string().optional(),
    slug: z.string().optional(),
    published: z.boolean().optional(),
  }),
  content: z.string()
})

export type JekyllPost = z.infer<typeof jekyllPostSchema>;