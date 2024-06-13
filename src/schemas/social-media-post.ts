import { z } from "zod";
import { CreativeWorkSchema } from "./creative-work.js";

export const SocialMediaPostingSchema = CreativeWorkSchema.extend({
  type: z.string().default('SocialMediaPosting'),
  sharedContent: z.string().url().optional()
});

export type SocialMediaPosting = z.infer<typeof SocialMediaPostingSchema>;