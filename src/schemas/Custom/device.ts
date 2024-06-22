import { ThingSchema } from "../schema-org/thing.js";
import { z } from "zod";

export const Resolution = z.string().or(z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
  dpi: z.coerce.number().optional(),
})).transform(sr => {
  if (typeof sr === 'string') {
    const dimensions = sr.split('x').map(s => s.trim());
    return { x: Number.parseInt(dimensions[0]) ?? 0, y: Number.parseInt(dimensions[1]) ?? 0}
  }
  return sr;
})

export const DeviceSchema = ThingSchema.extend({
  type: z.string().default('HardwareDevice'),
  dates: z.record(z.coerce.date()).optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  platform: z.string().optional(),
  model: z.string().optional(),
  cpu: z.string().optional(),
  mhz: z.string().optional(),
  mips: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  screen: Resolution.optional(),
  camera: Resolution.optional(),
  multi: z.coerce.number().optional(),
  msrp: z.string().optional(),
  notes: z.string().optional(),
})

export type Device = z.infer<typeof DeviceSchema>;












