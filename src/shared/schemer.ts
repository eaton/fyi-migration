import { Thing } from "../schemas/index.js";
import { getMeta, schemas } from "./schema-meta.js";
import { idSeparator } from "../schemas/index.js";

export function getId(input: string | Thing) {
  if (typeof input === 'string' && input.indexOf(idSeparator) > -1) {
    return input.split(idSeparator)[1];
  } else if (typeof input !== 'string') {
    return input.id;
  } else {
    // We should always have a type indicator in the ID. This is borked, yo.
    throw new TypeError('Thing ID lacked required type prefix')
  }
}

export function getRawType(input: string | Thing) {
  if (typeof input === 'string' && input.indexOf(idSeparator) > -1) {
    return input.split(idSeparator)[0];
  } else if (typeof input !== 'string') {
    return input.type;
  } else {
    // We should always have a type indicator in the ID. This is borked, yo.
    throw new TypeError('Thing ID lacked required type prefix')
  }
}

export function getSchema(input: string | Thing) {
  return getMeta(getRawType(input)).name;
}

export function getType(input: string | Thing) {
  const schema = getMeta(getRawType(input));
  if (schema.type) return schema.type;
  throw new TypeError(`No type metadata found for '${input}`);
}

export function getCollection(input: string | Thing) {
  const schema = getMeta(getRawType(input));
  if (schema.collection) return schema.collection;
  throw new TypeError(`No collection metadata found for '${input}`);
}

// Get all collection/bucket names used in the schema list.
export function listcollections() {
  const rawCollections = schemas.map(s => s.collection).filter(s => s !== undefined);
  return [...new Set<string>(rawCollections).values()];
}

export function getParser(input: string | Thing) {
  const schema = getMeta(getRawType(input));
  if (schema.parser) return schema.parser;
  throw new TypeError(`No collection metadata found for '${input}`);
}

