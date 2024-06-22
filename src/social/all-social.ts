import { Migrator } from '../shared/migrator.js';

import { TwitterMigrator } from "./twitter/twitter.js";
import { SkitchMigrator } from "./skitch.js";
import { LinkedInMigrator } from './linkedin.js'

export class AllSocialMigrator extends Migrator {
  override async run() {
    await new LinkedInMigrator({ logger: this.log }).run();
    await new SkitchMigrator({ logger: this.log }).run();
    await new TwitterMigrator({ logger: this.log }).run();
  }
}
