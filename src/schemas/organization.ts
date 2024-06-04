import { z } from 'zod';
import { ThingSchema } from './thing.js';
import { oneOrMany } from './one-or-many.js';

export const OrganizationSchema = ThingSchema.extend({
  type: z.string().default('Organization'),
  dates: z.record(z.coerce.date()).optional(),
  places: z.record(z.string()).optional(),
  memberOf: oneOrMany(z.string()), // none, one, or more string or string/order objects
});

export type Organization = z.infer<typeof OrganizationSchema>;
