import { BlogMigrator, BlogMigratorOptions } from "./blog-migrator.js";

const defaults: BlogMigratorOptions = {
  name: 'medium',
  label: 'Medium',
  description: 'Stuff I dumped onto Medium that never appeared elsewhere',
  input: 'input/blogs/medium',
  output: 'src/entries/medium',
}

export class MediumMigrator extends BlogMigrator {
  constructor(options: BlogMigratorOptions = {}) {
    super({...defaults, ...options});
  }

  override async finalize(): Promise<void> {
    this.input.copy(this.input.path('posts'), this.output.path(), { overwrite: true });
    await this.copyAssets('images', 'medium');
    return Promise.resolve();
  }
}