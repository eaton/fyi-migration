import jetpack from '@eatonfyi/fs-jetpack';
import {
  Csv,
  Frontmatter,
  Json,
  Json5,
  NdJson,
  Tsv,
  Yaml,
} from '@eatonfyi/serializers';
import 'dotenv/config';
// import { Arango } from '../storage/arango-store.js';

// Auto-serialize and deserilalize data for filenames with these suffixes
jetpack.setSerializer('.json', new Json());
jetpack.setSerializer('.ndjson', new NdJson());
jetpack.setSerializer('.json5', new Json5());
jetpack.setSerializer('.csv', new Csv());
jetpack.setSerializer('.tsv', new Tsv());
jetpack.setSerializer('.yaml', new Yaml());
jetpack.setSerializer('.md', new Frontmatter());

export function getDefaults() {
  return {
    root: process.env.MIGRATION_ROOT ?? './',
    input: process.env.MIGRATION_INPUT ?? 'input',
    cache: process.env.MIGRATION_CACHE ?? 'cache',
    output: process.env.MIGRATION_OUTPUT ?? 'output',
    assets: process.env.MIGRATION_ASSETS ?? 'assets',
    data: process.env.MIGRATION_DATA ?? 'data',
  };
}

/*
  arango: new Arango({
    url: process.env.ARANGO_URL || undefined,
    auth: {
      username: process.env.ARANGO_URL || 'root',
      password: process.env.ARANGO_PASS || '',
    },
    databaseName: process.env.ARANGO_DB || '_system'
  })
*/
