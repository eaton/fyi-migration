import { z } from "zod";

export const authorSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  mail: z.string().optional(),
  ip: z.string().optional(),
})

export type Author = z.infer<typeof authorSchema>;