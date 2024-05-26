import { z } from "zod";

export const RelationshipSchema = z.record(z.unknown()).and(z.object({
  _id: z.string(),
  _from: z.string(),
  _to: z.string(),
  _created: z.coerce.string().datetime().default(new Date(Date.now()).toISOString()),
  _updated: z.coerce.string().datetime().default(new Date(Date.now()).toISOString()),
}));
export type Relationship = z.infer<typeof RelationshipSchema>;
