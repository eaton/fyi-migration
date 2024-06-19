import { Migrator } from '../shared/migrator.js';
import { AppearanceMigrator } from './appearances.js';
import { ArticleReprintMigrator } from './article-reprints.js';
import { PodcastMigrator } from './podcasts.js';
// import { TalkMigrator } from './talks.js';

export class AllWorkMigrator extends Migrator {
  override async run() {
    await new ArticleReprintMigrator({ logger: this.log }).run();
    await new PodcastMigrator({ logger: this.log }).run();
    await new AppearanceMigrator({ logger: this.log }).run();
    // await new TalkMigrator({ logger: this.log }).run();
    return;
  }
}
