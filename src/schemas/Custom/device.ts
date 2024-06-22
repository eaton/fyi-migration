import { ThingSchema } from "../schema-org/thing.js";
import { DimensionsSchema } from "../fragments/dimensions.js";
import { z } from "zod";

export const DeviceSchema = ThingSchema.extend({
  type: z.string().default('HardwareDevice'),
  dates: z.record(z.coerce.date()).optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  platform: z.string().optional(),
  model: z.string().optional(),
  cpu: z.string().optional(),
  cores: z.coerce.number().optional(),
  mhz: z.string().optional(),
  mips: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  screen: DimensionsSchema.optional(),
  camera: DimensionsSchema.optional(),
  multi: z.coerce.number().optional(),
  msrp: z.string().optional(),
  notes: z.string().optional(),
})

export type Device = z.infer<typeof DeviceSchema>;












