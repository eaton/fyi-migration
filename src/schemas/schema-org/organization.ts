import { z } from 'zod';
import { oneOrMany, recordWithHints } from '../fragments/index.js';
import { ThingSchema } from './thing.js';

export const OrganizationSchema = ThingSchema.extend({
  type: z.string().default('Organization'),
  dates: recordWithHints(z.coerce.date(), [
    'founding',
    'dissolution',
  ]).optional(),
  places: z.record(z.string()).optional(),
  memberOf: oneOrMany(z.string()).optional(), // none, one, or more string or string/order objects
});

export type Organization = z.infer<typeof OrganizationSchema>;
