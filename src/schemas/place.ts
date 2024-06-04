import { z } from 'zod';
import { oneOrMany } from './one-or-many.js';
import { ThingSchema } from './thing.js';

export const PlaceSchema = ThingSchema.extend({
  type: z.string().default('Place'),
  dates: z.record(z.coerce.date()).optional(),
  place: z.string().optional(),
  isVirtual: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isPartOf: oneOrMany(z.string()), // none, one, or more string or string/order objects
  hasPart: oneOrMany(z.string()), // none, one, or more string or string/order objects
});

export type Place = z.infer<typeof PlaceSchema>;
