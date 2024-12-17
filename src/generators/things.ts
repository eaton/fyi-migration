import { getType, ThingSchema } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';
import { groupBy } from '../util/group-by.js';

export interface ThingGeneratorOptions extends MigratorOptions {
  ignore?: string | string[];
}

const defaults: ThingGeneratorOptions = {
  name: 'things',
  description: 'People, places, and other free-floating reference entities',
  input: 'input',
  output: 'src/_data',
};

export class ThingGenerator extends Migrator {
  declare options: ThingGeneratorOptions;

  constructor(options: ThingGeneratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    await this.writeGroupedCollectionData('things');
  }

  async writeGroupedCollectionData(name: string) {
    const ignore = Array.isArray(this.options.ignore)
      ? this.options.ignore
      : [this.options.ignore];

    const collection = this.arango.collection(name);
    const q = aql`FOR p in ${collection} RETURN UNSET(p, '_id', '_key', '_rev')`;
    const results = await this.arango.query(q).then(cursor => cursor.all());
    const things = results.map(r => ThingSchema.parse(r));
    const grouped = groupBy(things, t => getType(t.id));

    for (const [type, group] of Object.entries(grouped)) {
      if (group && !ignore.includes(type)) {
        this.output.write(`${type}.ndjson`, group);
        this.log.info(
          `Saved ${group?.length} records to '_data/${type}.ndjson'`,
        );
      }
    }
    return;
  }
}
