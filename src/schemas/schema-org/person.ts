import { z } from 'zod';
import { oneOrMany, recordWithHints } from '../fragments/index.js';
import { ThingSchema } from './thing.js';

export const PersonSchema = ThingSchema.extend({
  type: z.string().default('Person'),
  dates: recordWithHints(z.coerce.date(), ['birth', 'death']).optional(),
  places: z.record(z.string()).optional(),
  knows: oneOrMany(z.string()).optional(),
  knowsAbout: oneOrMany(z.string()).optional(),
  isFictional: z.boolean().optional(),
  isPartOf: oneOrMany(z.string())
    .optional()
    .describe(
      'For People, this includes organization membership, employment, etc.',
    ),
  relation: z.record(z.string().or(z.array(z.string()))).optional(), // Either a single string, or a dictionary of strings or string arrays.
});

export type Person = z.infer<typeof PersonSchema>;
