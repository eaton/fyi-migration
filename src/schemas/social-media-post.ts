import { z } from "zod";
import { CreativeWorkSchema } from "./creative-work.js";
import { urlSchema } from "./url.js";

export const SocialMediaPostingSchema = CreativeWorkSchema.extend({
  type: z.string().default('SocialMediaPosting'),
  sharedContent: urlSchema.optional()
});

export type SocialMediaPosting = z.infer<typeof SocialMediaPostingSchema>;