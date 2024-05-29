import { z } from 'zod';

/**
 * @see {@link https://jekyllrb.com/docs/configuration/default/ }
 */
export const jekyllConfigSchema = z.object({
  source: z.string().default('.'),
  destination: z.string().default('./_site'),
  collections_dir: z.string().default('.'),
  plugins_dir: z.string().default('_plugins'),
  layouts_dir: z.string().default('_layouts'),
  data_dir: z.string().default('_data'),
  includes_dir: z.string().default('_includes'),
  sass: z.object({
    sass_dir: z.string().default('_sass')
  }),
  collections: z.record(z.object({
    output: z.boolean().default(true)
  })),

  safe: z.boolean().default(true),
  include: z.array(z.string()).default(['.htaccess']),
  exclude: z.array(z.string()).default(["Gemfile", "Gemfile.lock", "node_modules", "vendor/bundle/", "vendor/cache/", "vendor/gems/", "vendor/ruby/"]),
  keep_files: z.array(z.string()).default([".git", ".svn"]),
  encoding: z.string().default('utf8'),
  markdown_ext: z.string().default('markdown,mkdown,mkdn,mkd,md'),
  strict_front_matter: z.boolean().default(false),

  show_drafts: z.boolean().optional(),
  limit_posts: z.number().default(0),
  future: z.boolean().default(false),
  unpublished: z.boolean().default(false)
});

export type JekyllConfig = z.infer<typeof jekyllConfigSchema>;

/**

Not yet supported:

# Plugins
whitelist           : []
plugins             : []

# Conversion
markdown            : kramdown
highlighter         : rouge
lsi                 : false
excerpt_separator   : "\n\n"
incremental         : false


# Outputting
permalink           : date
paginate_path       : /page:num
timezone            : null

quiet               : false
verbose             : false
defaults            : []


# Markdown Processors
kramdown:
  auto_ids          : true
  entity_output     : as_char
  toc_levels        : [1, 2, 3, 4, 5, 6]
  smart_quotes      : lsquo,rsquo,ldquo,rdquo
  input             : GFM
  hard_wrap         : false
  footnote_nr       : 1
  show_warnings     : false

*/