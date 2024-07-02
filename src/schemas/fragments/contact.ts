import { z } from 'zod';

export const ContactSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    addresss: z.string().optional(),
    telephone: z.string().optional(),
    fax: z.string().optional(),
    url: z.string().url().optional(),
  })
  .describe('Contact information for a Person or Organization.');

export type Contact = z.infer<typeof ContactSchema>;
