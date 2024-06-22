import { Migrator, MigratorOptions } from "../shared/index.js";

const defaults: MigratorOptions = {
  input: 'input/social/skitch',
  assets: 'src/_static/skitch'
};

export class SkitchMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    await this.copyAssets();
    return;
  }
}