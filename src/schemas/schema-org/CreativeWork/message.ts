import { z } from 'zod';
import { CreativeWorkSchema } from '../creative-work.js';
import { oneOrMany } from '../fragments/index.js';

export const MessageSchema = CreativeWorkSchema.extend({
  type: z.string().default('Message'),
  discussionGroup: oneOrMany(z.string()).optional(),
  replyTo: oneOrMany(z.string()).optional(),
  from: z.string().optional(),
  to: oneOrMany(z.string()).optional(),
  cc: oneOrMany(z.string()).optional(),
  bcc: oneOrMany(z.string()).optional(),
  attachment: oneOrMany(z.string()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
