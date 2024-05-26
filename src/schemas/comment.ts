import { z } from "zod";

export const CommentSchema = z.object({});
export type Comment = z.infer<typeof CommentSchema>;
