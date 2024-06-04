import { z } from 'zod';
import { ThingSchema } from './thing.js';
import { oneOrMany } from './one-or-many.js';

export const PersonSchema = ThingSchema.extend({
  type: z.string().default('Person'),
  dates: z.record(z.coerce.date()).optional(),
  places: z.record(z.string()).optional(),
  knows: oneOrMany(z.string()),
  knowsAbout: oneOrMany(z.string()),
  isFictional: z.boolean().optional(),
  isPartOf: oneOrMany(z.string()).describe('For People, this includes organization membership, employment, etc.'),
  relation: z.record(z.string().or(z.array(z.string())))
    .optional(), // Either a single string, or a dictionary of strings or string arrays.
});

export type Person = z.infer<typeof PersonSchema>;
