import { z } from "zod";

export const BookSchema = z.object({});
export type Book = z.infer<typeof BookSchema>;
