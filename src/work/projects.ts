import { z } from 'zod';
import { urlSchema } from '../schemas/fragments/index.js';
import { SheetMigrator, SheetMigratorOptions } from '../shared/sheet-migrator.js';
import { Organization, OrganizationSchema } from '../schemas/schema-org/organization.js';
import { Project, ProjectSchema } from '../schemas/schema-org/CreativeWork/project.js';
import { toId } from '../schemas/index.js';

const projectImportSchema = z.object({
  id: z.string().transform(i => i ? toId('project', i) : undefined),
  name: z.string(),
  additionalType: z.string().optional(),
  rank: z.number().optional(),
  dates: z
    .object({
      start: z.coerce.date().optional(),
      end: z.coerce.date().optional(),
    })
    .optional(),
  description: z.string().optional(),
  client: z.object({
    id: z.string().transform(i => i ? toId('org', i) : undefined),
    name: z.string().optional(),
    url: urlSchema.optional(),
  }).optional(),
  vertical: z.string().optional(),
  employer: z.object({
    id: z.string().transform(i => i ? toId('org', i) : undefined),
    name: z.string().optional(),
    url: urlSchema.optional(),
  }).optional(),
  url: urlSchema.optional(),
  archivedAt: z.string().optional(),
  usage: z.coerce.number().optional(),
  skills: z.object({
    production: z.coerce.boolean().default(false),
    code: z.coerce.boolean().default(false),
    education: z.coerce.boolean().default(false),
    architecture: z.coerce.boolean().default(false),
    ia: z.coerce.boolean().default(false),
    strategy: z.coerce.boolean().default(false),
    process: z.coerce.boolean().default(false),
  }).optional(),
  tech: z.array(z.string()).optional()
});

const defaults: SheetMigratorOptions = {
  name: 'projects',
  description: 'Projects and roles over the years',
  documentId: process.env.GOOGLE_SHEET_WORK,
  sheetName: 'projects',
  schema: projectImportSchema
};

export class ProjectMigrator extends SheetMigrator {
  declare options: SheetMigratorOptions;

  orgs: Organization[] = [];
  projects: Project[] = [];
  roles: Project[] = [];
  clients = new Map<string, string>()
  employers = new Map<string, string>();

  constructor(options: SheetMigratorOptions = {}) {
    super({ ...defaults, ...options });
  }

  override async readCache() {
    const data = this.cache.read('projects.ndjson', 'auto');

    if (data && Array.isArray(data)) {
      const projects = data.map(p => this.options.schema?.parse(p));
      for (const p of projects) {
        const { client, employer, vertical, skills, tech, ...rawProject } = p;

        if (p.additionalType?.endsWith('Role')) {
          this.log.error(`Skipped role '${p.name}'`);
        } else { 
          const project = ProjectSchema.parse(rawProject);

          const keywords = tech ?? [];
          for (const [skill, flag] of Object.entries(skills ?? {})) {
            if (flag) keywords.push(skill);
          }
          if (vertical) {
            keywords.push(vertical);
          }
          if (keywords.length) {
            project.keywords = keywords;
          }

          const creator: Record<string, string> = {};
          if (client && client.id) {
            if (client.name) {
              const c = OrganizationSchema.parse(client);
              this.orgs.push(c);
            }
              creator['sourceOrganization'] = client.id;
            this.clients.set(project.id, client.id);
          }
          if (employer && employer.id) {
            if (employer.name) {
              const e = OrganizationSchema.parse(employer);
              this.orgs.push(e);
            }
            creator['sponsor'] = employer.id;
            this.employers.set(project.id, employer.id);
          }
          if (creator.sourceOrganization || creator.sponsor) {
            project.creator = creator;
          }

          this.projects.push(project);
        }
      }
    }
    return;
  }

  override async finalize() {
    await this.saveThings(this.orgs);
    await this.saveThings(this.projects);
    for (const [to, from] of this.clients.entries()) {
      await this.linkThings(from, to, 'sponsor');
    }
    for (const [from, to] of this.clients.entries()) {
      await this.linkThings(from, to, 'sourceOrganization');
    }
    return;
  }
}
