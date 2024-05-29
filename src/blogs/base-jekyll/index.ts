import { BlogMigrator, BlogMigratorOptions } from "../blog-migrator.js";
import { Frontmatter, FrontmatterInput } from "@eatonfyi/serializers";
import * as schemas from './schema.js';
import { parse as parsePath } from 'path'
import { get, set, merge } from 'obby';


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
  }

  async loadConfigFile() {
    this.configFile = schemas.jekyllConfigSchema.parse(
      (this.input.read('_config.yml', 'auto') ?? {})
    );
  }

  async loadDataFiles() {
    const dataDir = this.input.dir(this.configFile?.data_dir ?? '_data');
    for (const dataFile of dataDir.find({ matching: '*.(yml,yaml,json,tsv,csv)' })) {
      const key = parsePath(dataFile).name;
      const data = dataDir.read(dataFile, 'auto') ?? undefined;
      this.dataFiles[key] = data;
    }
  }

  async loadPosts() {
    let defaults = {};
    if (this.options.mergeFrontmatterDefaults && this.configFile) {
      defaults = get(this.configFile, 'defaults') ?? {};
    }

    const markdown_ext = this.configFile?.markdown_ext ?? 'markdown,mkdown,mkdn,mkd,md';
    const postsDir = this.input.dir('_posts');
    const fm = new Frontmatter();
    for (const postFile of postsDir.find({ matching: `**/*.(${markdown_ext},htm,html)` })) {
      this.posts[postFile] = postsDir.read(postFile, fm.parse) ?? undefined;
      this.posts[postFile].data = merge(defaults, this.posts[postFile].data);
    }
  }
}