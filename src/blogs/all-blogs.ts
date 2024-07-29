import { Migrator } from '../shared/migrator.js';

import { AltDrupalMigrator } from './alt-drupal/alt-drupal.js';
import { AltJekyllMigrator } from './alt-jekyll/jekyll.js';
import { FuturismMigrator } from './futurism.js';
import { GoddyMigrator } from './goddy/goddy.js';
import { GuestBlogMigrator } from './guest-blogs.js';
import { LivejournalMigrator } from './livejournal/livejournal.js';
import { MediumMigrator } from './medium.js';
import { MovableTypeMigrator } from './movabletype/movabletype.js';
import { PositivaDrupalMigrator } from './positiva-drupal/positiva-drupal.js';
import { PredicateNetMigrator } from './predicatenet.js';
import { TumblrMigrator } from './tumblr/tumblr.js';

export class AllBlogMigrator extends Migrator {
  override async run() {
    await new LivejournalMigrator({ logger: this.log }).run();
    await new PredicateNetMigrator({ logger: this.log }).run();
    await new MovableTypeMigrator({ logger: this.log }).run();
    await new GuestBlogMigrator({ logger: this.log }).run();
    await new FuturismMigrator({ logger: this.log }).run();
    await new PositivaDrupalMigrator({ logger: this.log }).run();
    await new AltDrupalMigrator({ logger: this.log }).run();
    await new GoddyMigrator({ logger: this.log }).run();
    await new MediumMigrator({ logger: this.log }).run();
    await new TumblrMigrator({ logger: this.log }).run();
    await new AltJekyllMigrator({ logger: this.log }).run();
    return;
  }
}
