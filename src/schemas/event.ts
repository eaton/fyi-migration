import { z } from 'zod';
import { oneOrMany } from './one-or-many.js';
import { ThingSchema } from './thing.js';

export const EventSchema = ThingSchema.extend({
  type: z.string().default('Event'),
  dates: z.record(z.coerce.date()).optional(),
  places: z.record(z.string()).optional(),
  isPartOf: oneOrMany(z.string()), // none, one, or more string or string/order objects
  hasPart: oneOrMany(z.string()), // none, one, or more string or string/order objects
});

export type Event = z.infer<typeof EventSchema>;
