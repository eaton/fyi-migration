import { Migrator } from "./shared/migrator.js";
import { CreativeWork } from "./schemas/creative-work.js";

/**
 * There are a bunch of random post-migration cleanup tasks to
 * perform that may be handled differently in the future, but
 * need to be efficiently centralized for now. For example, our
 * crude "dump random JSON files in the _data dir" approach results
 * in a TON of uneeded cruft, and won't actually translate to a
 * nice eleventy experience, so we read them all in and splonk
 * them into a single .ndjson file, accumulating some statistics
 * as we go.
 */
export class PostMigrationCleanup extends Migrator {
  override async run() {
    const ldir = this.root.dir('src/_data/links');

    const linkList: CreativeWork[] = [];
    for (const f of ldir.find({ matching: '*.json' })) {
      const link = ldir.read(f, 'auto') as CreativeWork;
      link.description = link.description?.trim();
      link.name = link.name?.trim();
      linkList.push(link);
    }
    ldir.write('links.csv', linkList);
    return;
  }
}