import { Article } from '../schemas/schema-org/CreativeWork/article.js';
import { Migrator, MigratorOptions } from '../shared/migrator.js';

export interface KidstuffMigratorOptions extends MigratorOptions {

}


const defaults: KidstuffMigratorOptions = {
  name: 'kidstuff',
  description: 'Old issues of Kidstuff Magazine',
  input: 'input/kidstuff',
  output: 'src/kidstuff',
};

export class ArticleReprintMigrator extends Migrator {
  declare options: KidstuffMigratorOptions;
  issues: Article[] = [];

  constructor(options: KidstuffMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }
}
