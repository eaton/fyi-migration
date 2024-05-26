import { z } from "zod";

export const LinkSchema = z.object({});
export type Link = z.infer<typeof LinkSchema>;
