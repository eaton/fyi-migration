import { z } from 'zod';
import { oneOrMany } from './one-or-many.js';

export const ThingSchema = z
  .object({
    id: z.string(),
    type: z.string().default('Thing'),
    name: z.string().optional(),
    alternateName: oneOrMany(z.string(), { optional: true, expand: false }),
    description: z.string().optional(),
    url: z.string().optional(),
    image: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();

export type Thing = z.infer<typeof ThingSchema>;
export type ThingInput = typeof ThingSchema._input;
