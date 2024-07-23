import { z } from 'zod';
import { oneOrMany } from '../fragments/index.js';
import { ThingSchema } from './thing.js';

export const CreativeWorkSchema = ThingSchema.extend({
  type: z.string().default('CreativeWork'),
  date: z.coerce.date().optional(),
  dates: z.record(z.coerce.date()).optional(),
  headline: z.string().optional(),
  creator: z
    .string()
    .or(z.record(z.string().or(z.array(z.string()))))
    .optional(), // Either a single string, or a dictionary of strings or string arrays.
  about: oneOrMany(z.string()).optional(),
  isPartOf: oneOrMany(z.string()).optional(), // none, one, or more string or string/order objects
  hasPart: oneOrMany(z.string()).optional(), // none, one, or more string or string/order objects
  publisher: z.string().optional(),
  archivedAt: z.string().optional(),
  text: z.string().optional(),
  commentCount: z.number().optional(),
});

export type CreativeWork = z.infer<typeof CreativeWorkSchema>;
export type CreativeWorkInput = typeof CreativeWorkSchema._input;
