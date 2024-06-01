import { z } from 'zod';

const PhotoSchema = z
  .object({
    caption: z.string(),
    exif: z.record(z.string()),
    original_size: z.record(z.string().or(z.number())),
  })
  .partial();

export const PostSchema = z
  .object({
    type: z.string(),
    is_blocks_post_format: z.boolean(),
    blog_name: z.string(),
    id: z.coerce.number(),
    //id_string: z.string(),
    //is_blazed: z.boolean(),
    //is_blaze_pending: z.boolean(),
    //can_ignite: z.boolean(),
    //can_blaze: z.boolean(),
    post_url: z.string(),
    slug: z.string(),
    date: z.string(),
    timestamp: z.number(),
    state: z.string(),
    format: z.string(),
    // reblog_key: z.string(),
    tags: z.array(z.string()),
    short_url: z.string(),
    summary: z.string(),
    // should_open_in_legacy: z.boolean(),
    // recommended_source: z.string().nullable(),
    // recommended_color: z.string().nullable(),
    // followed: z.boolean(),
    // liked: z.boolean(),
    note_count: z.number(),
    title: z.string().nullable(),
    body: z.string(),
    // can_like: z.boolean(),
    // interactability_reblog: z.string(),
    // interactability_blaze: z.string(),
    // can_reblog: z.boolean(),
    // can_send_in_message: z.boolean(),
    muted: z.boolean(),
    // mute_end_timestamp: z.number(),
    // can_mute: z.boolean(),
    // can_reply: z.boolean(),
    // display_avatar: z.boolean(),
    caption: z.string().describe('Populated on Image and Video posts'),
    description: z.string(),
    excerpt: z.string().nullable().describe('Used on some link posts'),
    source_url: z
      .string()
      .describe(
        'Populated when videos or images are shared from a particular page',
      ),
    source_title: z.string(),
    publisher: z.string(),
    url: z.string().describe('Populated for Link posts'),
    permalink_url: z
      .string()
      .describe('Populated for for Video and Image posts'),
    image_permalink: z.string(),
    video_type: z.string(),
    video: z.record(
      z.object({
        video_id: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    ),
    photos: z.array(PhotoSchema),
  })
  .partial();

export const ThemeSchema = z
  .object({
    avatar_shape: z.string(),
    background_color: z.string(),
    body_font: z.string(),
    header_bounds: z.unknown(),
    header_image: z.string(),
    header_image_focused: z.string(),
    header_image_poster: z.string(),
    header_image_scaled: z.string(),
    header_stretch: z.boolean(),
    link_color: z.string(),
    show_avatar: z.boolean(),
    show_description: z.boolean(),
    show_header_image: z.boolean(),
    show_title: z.boolean(),
    title_color: z.string(),
    title_font: z.string(),
    title_font_weight: z.string(),
  })
  .partial();

export const BlogSchema = z
  .object({
    admin: z.boolean(),
    ask: z.boolean(),
    ask_anon: z.boolean(),
    ask_page_title: z.string(),
    asks_allow_media: z.boolean(),
    avatar: z.unknown(),
    can_chat: z.boolean(),
    can_send_fan_mail: z.boolean(),
    can_submit: z.boolean(),
    can_subscribe: z.boolean(),
    description: z.string(),
    drafts: z.number(),
    facebook: z.string(),
    facebook_opengraph_enabled: z.string(),
    followed: z.boolean(),
    followers: z.number(),
    members: z.number(),
    is_blocked_from_primary: z.boolean(),
    is_nsfw: z.boolean(),
    messages: z.number(),
    name: z.string(),
    posts: z
      .union([z.array(PostSchema), z.number()])
      .transform(p => (typeof p === 'number' ? undefined : p)),
    primary: z.boolean(),
    queue: z.number(),
    share_likes: z.boolean(),
    submission_page_title: z.string(),
    submission_terms: z
      .object({
        accepted_types: z.array(z.string()),
        tags: z.array(z.string()),
        title: z.string(),
        guidelines: z.string(),
      })
      .partial(),
    subscribed: z.boolean(),
    theme: ThemeSchema,
    title: z.string(),
    total_posts: z.number(),
    tweet: z.string(),
    twitter_enabled: z.boolean(),
    twitter_send: z.boolean(),
    type: z.string(),
    updated: z.number(),
    url: z.string(),
    uuid: z.string(),
  })
  .partial();

export const UserSchema = z
  .object({
    name: z.string(),
    likes: z.number(),
    following: z.number(),
    default_post_format: z.string(),
    blogs: z.array(BlogSchema).optional(),
    timestamp: z.number().optional().default(Date.now()),
  })
  .partial();

export const UserInfoSchema = z.object({ user: UserSchema });

export type TumblrBlog = z.infer<typeof BlogSchema>;
export type TumblrUser = z.infer<typeof UserSchema>;
export type TumblrPost = z.infer<typeof PostSchema>;
