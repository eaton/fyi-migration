import { z } from 'zod';
import { CreativeWorkSchema } from './creative-work.js';
import { oneOrMany } from './one-or-many.js';

export const MessageSchema = CreativeWorkSchema.extend({
  type: z.string().default('Message'),
  discussionGroup: oneOrMany(z.string(), { expand: false }),
  replyTo: oneOrMany(z.string(), { expand: false }),
  from: z.string().optional(),
  to: oneOrMany(z.string(), { expand: false }),
  cc: oneOrMany(z.string(), { expand: false }),
  bcc: oneOrMany(z.string(), { expand: false }),
  attachment: oneOrMany(z.string(), { expand: false }),
});

export type Message = z.infer<typeof MessageSchema>;
