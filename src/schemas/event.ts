import { z } from 'zod';
import { oneOrMany, recordWithHints } from './fragments/index.js';
import { ThingSchema } from './thing.js';

export const EventSchema = ThingSchema.extend({
  type: z.string().default('Event'),
  dates: recordWithHints(z.coerce.date(), ['start', 'end']).optional(),
  places: z.record(z.string()).optional(),
  attendees: z.coerce.number().optional(),
  isPartOf: oneOrMany(z.string()).optional(), // none, one, or more string or string/order objects
  hasPart: oneOrMany(z.string()).optional(), // none, one, or more string or string/order objects
});

export type Event = z.infer<typeof EventSchema>;
