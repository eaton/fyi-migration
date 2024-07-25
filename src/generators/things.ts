import { Migrator, MigratorOptions } from "../shared/index.js";
import { aql } from "arangojs";
import { getType, ThingSchema } from "@eatonfyi/schema";
import { groupBy } from "../util/group-by.js";

const defaults: MigratorOptions = {
  name: 'things',
  description: 'People, places, and other free-floating reference entities',
  input: 'input',
  output: 'src/_data',
};

export class ThingMigrator extends Migrator {
  constructor(options: MigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    await this.writeGroupedCollectionData('things');
    await this.writeGroupedCollectionData('products');
    await this.writeGroupedCollectionData('events');
  }

  async writeGroupedCollectionData(name: string) {
    const collection = this.arango.collection(name);
    const q = aql`FOR p in ${collection} RETURN UNSET(p, '_id', '_key', '_rev')`;
    const results = await this.arango.query(q).then(cursor => cursor.all());
    const things = results.map(r => ThingSchema.parse(r));
    const grouped = groupBy(things, t => getType(t.id));
    for (const [type, group] of Object.entries(grouped)) {
      if (group) {
        this.output.write(`${type}.ndjson`, group);
        this.log.info(`Saved ${group?.length} records to '_data/${type}.ndjson'`);
      }
    }
    return;
  }
}

