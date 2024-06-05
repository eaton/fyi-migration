// Read 'work' tsv file, create a project or web site record for each item
// Create an 'organization' item for each client or employer
// Manually update appropriate projects with detailed explanations, related articles, screenshots, etc.

import { z } from 'zod';
import { unflatten } from 'obby';
import { MigratorOptions, Migrator } from '../shared/index.js';
