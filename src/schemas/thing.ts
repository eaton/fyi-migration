import { z } from 'zod';
import { oneOrMany, urlSchema } from './fragments/index.js';

export const ThingSchema = z
  .object({
    id: z.coerce.string(),
    url: urlSchema.optional(),
    ids: z.record(z.coerce.string()).optional(),
    type: z.string().default('Thing'),
    name: z.string().optional(),
    importance: z.number().min(1).max(5).optional(),
    alternateName: oneOrMany(z.string()).optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();

export type Thing = z.infer<typeof ThingSchema>;
