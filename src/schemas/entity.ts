import { z } from "zod";

export const EntitySchema = z.record(z.unknown()).and(z.object({
  _id: z.string(),
  _created: z.coerce.string().datetime().default(new Date(Date.now()).toISOString()),
  _updated: z.coerce.string().datetime().default(new Date(Date.now()).toISOString()),
}));
export type Entity = z.infer<typeof EntitySchema>;
