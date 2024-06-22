import { z } from 'zod';
import { urlSchema } from '../fragments/index.js';
import { CreativeWorkSchema } from '../schema-org/creative-work.js';

/**
 * A special-case version of the base SocialMediaPosting type that
 * we use to store bookmarks and shared links from a variety of sources.
 *
 * Note that the link being shared goes in `sharedContent`, not `url`;
 * the url property is the canonical URL of the post in which the link
 * is shared.
 *
 * If the original version of a link is dead-dead but an archived version
 * is available (e.g., through the Wayback Machine), use the isArchivedAt
 * property from the base CreativeWorkSchema.
 */
export const BookmarkSchema = CreativeWorkSchema.extend({
  type: z.string().default('Bookmark'),
  sharedContent: urlSchema,
});

export type Bookmark = z.infer<typeof BookmarkSchema>;
