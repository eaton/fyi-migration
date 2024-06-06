import { z } from 'zod';
import { oneOrMany } from './one-or-many.js';
import { ThingSchema } from './thing.js';

export const PersonSchema = ThingSchema.extend({
  type: z.string().default('Person'),
  dates: z.record(z.coerce.date()).optional(),
  places: z.record(z.string()).optional(),
  knows: oneOrMany(z.string(), { optional: true, expand: false }),
  knowsAbout: oneOrMany(z.string(), { optional: true, expand: false }),
  isFictional: z.boolean().optional(),
  isPartOf: oneOrMany(z.string(), { optional: true, expand: false }).describe(
    'For People, this includes organization membership, employment, etc.',
  ),
  relation: z.record(z.string().or(z.array(z.string()))).optional(), // Either a single string, or a dictionary of strings or string arrays.
});

export type Person = z.infer<typeof PersonSchema>;
