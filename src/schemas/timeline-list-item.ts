import { z } from 'zod';
import { oneOrMany } from './fragments/index.js';
import { ThingSchema } from './thing.js';

export const TimelineListItemSchema = ThingSchema.extend({
  type: z.string().default('TimelineListItem'),
  isPartOf: oneOrMany(z.string()).optional(),
  source: z.string().optional(),
  category: z.string().optional(),
});

export type TimelineListItem = z.infer<typeof TimelineListItemSchema>;
