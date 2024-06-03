import { z } from 'zod';

export const ThingSchema = z
  .object({
    id: z.string(),
    type: z.string().default('Thing'),
    title: z.string().optional(),
    description: z.string(),
    url: z.string().optional(),
    image: z.string().optional(),
    content: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();

export type Thing = z.infer<typeof ThingSchema>;
