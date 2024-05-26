import 'dotenv/config';
import jetpack from '@eatonfyi/fs-jetpack';
import { Json, NdJson, Json5, Csv, Tsv, Yaml, Frontmatter } from '@eatonfyi/serializers';

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
    proxies:process.env.PROXIES?.split(' ') ?? [],
    cache: jetpack.dir(process.env.MIGRATION_ROOT ?? './cache'),
    output: jetpack.dir(process.env.MIGRATION_OUTPUT ?? './output'),
  } 
}