import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { urlSchema } from './url.js';
import { oneOrMany } from './helpers.js';

export const SocialMediaPostingSchema = CreativeWorkSchema.extend({
  type: z.string().default('SocialMediaPosting'),
  sharedContent: oneOrMany(urlSchema).optional(),
});

export type SocialMediaPosting = z.infer<typeof SocialMediaPostingSchema>;
