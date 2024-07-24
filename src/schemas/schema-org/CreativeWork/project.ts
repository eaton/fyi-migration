import { z } from 'zod';
import { CreativeWorkSchema } from '../creative-work.js';


// We use creator.sourceOrganization for the employer, if one exists, and
// creator.sponsor for the client, if one exists. `artifact` should point to
// the url of an example of the work.
export const ProjectSchema = CreativeWorkSchema.extend({
  type: z.string().default('Project'),
  usage: z.number().optional(),
  additionalType: z.string().optional()
});

export type Project = z.infer<typeof ProjectSchema>;
