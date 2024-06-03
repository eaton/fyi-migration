import { z } from 'zod';
import { ThingSchema } from './thing.js';

const partSchema = z.string().or(z.array(z.string())).transform(i => (!!i && !Array.isArray(i) ? [i] : i));

export const CreativeWorkSchema = ThingSchema.extend({
  type: z.string().default('CreativeWork'),
  date: z.coerce.date().optional(),
  dates: z.record(z.coerce.date()).optional(),
  headline: z.string().optional(),
  creator: z
    .string()
    .or(z.record(z.string().or(z.array(z.string()))))
    .optional(), // Either a single string, or a dictionary of strings or string arrays.
  about: z.string().optional(),
  isPartOf: partSchema.optional(), // none, one, or more string or string/order objects
  hasPart: partSchema.optional(), // none, one, or more string or string/order objects
  archivedAt: z.string().optional(),
  text: z.string().optional(),
});

export type CreativeWork = z.infer<typeof CreativeWorkSchema>;
export type CreativeWorkInput = typeof CreativeWorkSchema._input;
