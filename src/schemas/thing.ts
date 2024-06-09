import { z } from 'zod';
import { oneOrMany } from './helpers.js';

export const ThingSchema = z
  .object({
    id: z.string(),
    ids: z.record(z.string()).optional(),
    type: z.string().default('Thing'),
    name: z.string().optional(),
    category: z.string().optional(),
    importance: z.number().min(1).max(5).optional(),
    alternateName: oneOrMany(z.string()).optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    image: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();

export type Thing = z.infer<typeof ThingSchema>;
export type ThingInput = typeof ThingSchema._input;
