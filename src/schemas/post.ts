import { z } from "zod";

export const PostSchema = z.object({});
export type Post = z.infer<typeof PostSchema>;
