import { z } from 'zod';
import { ThingSchema } from './thing.js';

const partSchema = z
  .string()
  .or(z.object({ name: z.string(), order: z.string().optional() }))
  .transform(r => (typeof r === 'string' ? { name: r } : r));

export const CreativeWorkSchema = ThingSchema.extend({
  type: z.string().default('CreativeWork'),
  date: z.coerce.date().optional(),
  dates: z.record(z.coerce.date()).optional(),
  creator: z
    .string()
    .or(z.record(z.string().or(z.array(z.string()))))
    .optional(), // Either a single string, or a dictionary of strings or string arrays.
  about: z.string().optional(),
  isPartOf: partSchema.or(z.array(partSchema)).optional(), // none, one, or more string or string/order objects
  hasPart: partSchema.or(z.array(partSchema)).optional(), // none, one, or more string or string/order objects
  archivedAt: z.string().optional(),
});

export type CreativeWork = z.infer<typeof CreativeWorkSchema>;
