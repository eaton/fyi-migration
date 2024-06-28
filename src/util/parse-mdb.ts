import jetpack from '@eatonfyi/fs-jetpack';
import MDBReader from 'mdb-reader';
import micromatch from 'micromatch';
import { z } from 'zod';
const isMatch = micromatch.isMatch;

export function parseMdbFile(mdbFile: string, tables: string | string[] = '*') {
  const reader = new MDBReader(jetpack.read(mdbFile, 'buffer') as Buffer);
  const tableNames = reader
    .getTableNames()
    .filter(t => isMatch(t, tables ?? ''));
  return Object.fromEntries(
    tableNames.map(t => [t, reader.getTable(t).getData()]),
  );
}

export function parseMdbTable<T extends z.ZodTypeAny>(
  mdbFile: string | MDBReader,
  table: string,
  schema?: T,
  strict = false,
): z.infer<T>[] {
  const reader =
    typeof mdbFile === 'string'
      ? new MDBReader(jetpack.read(mdbFile, 'buffer') as Buffer)
      : mdbFile;

  const rows = reader.getTable(table).getData();

  if (schema) {
    return rows
      .map(r => {
        if (strict) return schema.parse(r);
        return schema.safeParse(r).data ?? undefined;
      })
      .filter(r => r !== undefined);
  } else {
    return rows;
  }
}

export function getMdbInfo(mdbFile: string) {
  const b = jetpack.read(mdbFile, 'buffer');
  if (b) {
    const reader = new MDBReader(b);
    return {
      dateCreated: reader.getCreationDate() ?? undefined,
      password: reader.getPassword() ?? undefined,
      tables: reader.getTableNames(),
      systemTables: reader.getTableNames({
        normalTables: false,
        systemTables: true,
      }),
      linkedTables: reader.getTableNames({
        normalTables: false,
        linkedTables: true,
      }),
    };
  } else {
    throw new Error(`File not found: ${mdbFile}`);
  }
}
