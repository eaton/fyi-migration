import { z } from 'zod';

/**
 * Optional todos:
 *
 * - [ ] Auto-populate slug from title if it doesn't exist
 * - [ ] Auto-populate date from filename if it doesn't exist
 * - [ ] Auto-populate filename from date + slugified title
 * - [ ] Auto-populate ID from ids and type
 */

export const EleventyNavigationSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    parent: z.string().optional(),
    order: z.number().optional(),
    url: z.string().url().optional(),
  })
  .describe("Metadata to control Eleventy's nav + breadcrumb plugin.");

export const FrontmatterSchema = z
  .object({
    id: z.string().optional(), // IDs should follow a format like: `type/unique-key`
    date: z.coerce.date().optional(),
    slug: z.string().optional(),
    url: z
      .string()
      .url()
      .optional()
      .describe("The item's canonical offsite URL, if one exists."),
    source: z
      .string()
      .url()
      .optional()
      .describe(
        'The internal ID of the site the content was originally published on.',
      ),

    // Actual content-like metadata
    title: z.string().optional(),
    summary: z.string().optional(),
    excerpt: z.string().optional(),
    image: z.string().optional(),

    // We use this instead of 'tags' because 11ty auto-generates collections for 'tags'
    keywords: z.array(z.string()).optional(),

    layout: z.string().optional(),
    published: z.boolean().optional(),
    eleventyNavigation: EleventyNavigationSchema.optional(),
  })
  .passthrough();

export const MarkdownPostSchema = z.object({
  data: FrontmatterSchema,
  content: z.string().optional(),
});

export type MarkdownPost = z.infer<typeof MarkdownPostSchema>;
