import { ProjectSchema } from '@eatonfyi/schema';
import { aql } from 'arangojs';
import { Migrator, MigratorOptions } from '../shared/index.js';

export interface ProjectGeneratorOptions extends MigratorOptions {
  ignore?: string | string[];
}

const defaults: ProjectGeneratorOptions = {
  name: 'projects',
  description: "Things I've created or worked on.",
  input: 'input',
  output: 'src/_data',
};

export class ProjectGenerator extends Migrator {
  declare options: ProjectGeneratorOptions;

  constructor(options: ProjectGeneratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async finalize() {
    const collection = this.arango.collection('things');
    const q = aql`FOR w in ${collection}
    FILTER w.type == 'Project'
    RETURN UNSET(w, '_id', '_key', '_rev')`;

    const results = await this.arango.query(q).then(cursor => cursor.all());
    const projects = results.map(r => ProjectSchema.parse(r));

    this.output.write('projects.ndjson', projects);
    return;
  }
}
