import { z } from 'zod';
import { CreativeWorkSchema } from '../creative-work.js';
import { oneOrMany, urlSchema } from '../../fragments/index.js';

export const SocialMediaPostingSchema = CreativeWorkSchema.extend({
  type: z.string().default('SocialMediaPosting'),
  sharedContent: oneOrMany(urlSchema).optional(),
});

export type SocialMediaPosting = z.infer<typeof SocialMediaPostingSchema>;
