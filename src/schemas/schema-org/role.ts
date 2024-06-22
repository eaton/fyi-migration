import { z } from 'zod';
import { ThingSchema } from './thing.js';

export const RoleSchema = ThingSchema.extend({
  from: z.string(),
  to: z.string().or(ThingSchema),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type Role = z.infer<typeof RoleSchema>;
