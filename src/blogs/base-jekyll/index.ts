import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import { Frontmatter, FrontmatterInput } from "@eatonfyi/serializers";
import * as schemas from './schema.js';
import { parse as parsePath } from 'path'
import { get, merge } from 'obby';

export interface JekyllMigratorOptions extends BlogMigratorOptions {
  loadConfig?: boolean;
  loadDataFiles?: boolean;
  loadPosts?: boolean;
  mergeFrontmatterDefaults?: boolean
}

const defaults: JekyllMigratorOptions = {
  loadConfig: true,
  loadDataFiles: true,
  loadPosts: true,
  mergeFrontmatterDefaults: true,
}

export class JekyllMigrator extends BlogMigrator {
  declare options: JekyllMigratorOptions;
  configFile?: schemas.JekyllConfig = undefined;
  dataFiles: Record<string, unknown> = {};
  posts: Record<string, FrontmatterInput> = {};

  constructor(options: JekyllMigratorOptions = {}) {
    const opt = { ...defaults, ...options };
    super(opt);
    
    if (this.options.loadConfig) {
      this.loadConfigFile();
    }
  }

  loadConfigFile() {
    const config = schemas.jekyllConfigSchema.safeParse(
      (this.input.read('_config.yml', 'auto') ?? {})
    );

    if (config.error) {
      this.log.error({ error: config.error }, `Error loading _config.yml`);
    } else {
      this.configFile = config.data;
    }
  }

  loadDataFiles() {
    const dataDir = this.input.dir(this.configFile?.data_dir ?? '_data');
    
    for (const dataFile of dataDir.find({ matching: '*.(yml,yaml,json,tsv,csv)' })) {
      try {
        const key = parsePath(dataFile).name;
        const data = dataDir.read(dataFile, 'auto') ?? undefined;
        this.dataFiles[key] = data;  
      } catch(error: unknown) {
        this.log.error({ filename: dataFile, error }, `Error loading datafile`);
      }
    }
  }

  loadPosts() {
    let defaults = {};
    if (this.options.mergeFrontmatterDefaults && this.configFile) {
      defaults = get(this.configFile, 'defaults') ?? {};
    }

    const markdown_ext = this.configFile?.markdown_ext ?? 'markdown,mkdown,mkdn,mkd,md';
    const postsDir = this.input.dir('_posts');
    const fm = new Frontmatter();
    
    for (const postFile of postsDir.find({ matching: `**/*.(${markdown_ext},htm,html)` })) {
      try {
        this.posts[postFile] = postsDir.read(postFile, fm.parse) ?? undefined;
        this.posts[postFile].data = merge(defaults, this.posts[postFile].data);
      } catch(error: unknown) {
        this.log.error({ filename: postFile, error }, `Error loading post`);
      }
    }
  }
}