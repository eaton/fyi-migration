import { nanoid } from '@eatonfyi/ids';

export const idSeparator = '.';

export type SchemaRecord = {
  /**
   * The official Schema.org name of the schema
   */
  name: string;

  /**
   * The storage bucket, database table, or other collection items with this schema
   * should be stored in. If one is not given, its parent's collection will be used.
   */
  collection?: string;

  /**
   * The internal 'short name' for a schema, to be used when constructing keys, ids,
   * URL slugs, and so on. If one is not given, its parent's collection will be used.
   *
   * Note: Don't put multiple items with the same type into the mix; instead, create
   * a child with no type or collection. It will roll up to the parent automatically.
   */
  type?: string;

  /**
   * The parent schema this schema inherits from. Note that we're not handling Schemas
   * with multiple parents (aka VideoGame, which is both a CreativeWork > Game and a
   * CreativeWork > SoftwareApplication).
   */
  parent?: string;

  aliasOf?: string;

  /**
   * A flag indicating that the schema is a custom one not supported by Schema.org.
   * For the time being, we expose them as their Parent schema when building out
   * json-ld records, etc.
   */
  isCustom?: boolean;
};

interface WithId {
  id: string;
  type: string;
}

export function toId(type?: string, id?: string | unknown) {
  const internalType = getMeta(type || 'thing').type || 'thing';
  return [internalType, id || nanoid()].join(idSeparator);
}

/**
 * Given a schema name or shortname, return its record OR the first
 * parent record with type/collection information.
 */
export function getMeta(input: string): SchemaRecord {
  const schema = schemas().find(s => s.name === input || s.type === input);
  if (schema === undefined)
    throw new TypeError(`No matching schema for '${input}'`);
  if (schema.type === undefined || schema.collection === undefined) {
    if (schema.aliasOf) {
      return { ...getMeta(schema.aliasOf), ...schema };
    } else if (schema.parent) {
      return { ...getMeta(schema.parent), ...schema };
    } else {
      throw new TypeError(`No type, collection, or parent for '${input}`);
    }
  } else {
    return schema;
  }
}

/**
 * An extremely abbreviated list of Schema.org schemas, with several custom additions.
 *
 * Additional schemas can be added to this array, and will then be handled properly
 * during persistence.
 */
export function schemas(): SchemaRecord[] {
  return [
    { name: 'Thing', type: 'thing', collection: 'things' },
    {
      name: 'CreativeWork',
      parent: 'Thing',
      type: 'work',
      collection: 'works',
    },
    {
      name: 'Article',
      parent: 'CreativeWork',
      type: 'article',
      collection: 'works',
    },
    {
      name: 'SocialMediaPosting',
      parent: 'Article',
      type: 'post',
      collection: 'works',
    },
    {
      name: 'SocialMediaThread',
      parent: 'SocialMediaPosting',
      type: 'thread',
      collection: 'works',
      isCustom: true,
    },
    {
      name: 'Bookmark',
      parent: 'SocialMediaPosting',
      type: 'link',
      collection: 'works',
      isCustom: true,
    },
    { name: 'BlogPosting', parent: 'SocialMediaPosting' },
    { name: 'LiveBlogPosting', parent: 'BlogPosting' },
    { name: 'DiscussionForumPosting', parent: 'SocialMediaPosting' },
    { name: 'Blog', parent: 'CreativeWork', type: 'blog', collection: 'works' },
    {
      name: 'Book',
      parent: 'CreativeWork',
      type: 'book',
      collection: 'products',
    },
    { name: 'Clip', parent: 'CreativeWork', type: 'clip' },
    {
      name: 'Collection',
      parent: 'CreativeWork',
      type: 'collection',
      collection: 'works',
    },
    {
      name: 'Comment',
      parent: 'CreativeWork',
      type: 'comment',
      collection: 'works',
    },
    {
      name: 'Conversation',
      parent: 'CreativeWork',
      type: 'chat',
      collection: 'works',
    },
    { name: 'Series', aliasOf: 'CreativeWorkSeries' },
    {
      name: 'CreativeWorkSeries',
      parent: 'CreativeWork',
      type: 'series',
      collection: 'works',
    },
    { name: 'VideoGameSeries', parent: 'CreativeWorkSeries' },
    {
      name: 'Periodical',
      parent: 'CreativeWorkSeries',
      type: 'magazine',
      collection: 'works',
    },
    {
      name: 'PodcastSeries',
      parent: 'CreativeWorkSeries',
      type: 'podcast',
      collection: 'works',
    },
    {
      name: 'TVSeries',
      parent: 'CreativeWorkSeries',
      type: 'show',
      collection: 'works',
    },
    {
      name: 'DefinedTermSet',
      parent: 'CreativeWork',
      type: 'taxonomy',
      collection: 'works',
    },
    {
      name: 'Episode',
      parent: 'CreativeWork',
      type: 'episode',
      collection: 'works',
    },
    { name: 'PodcastEpisode', parent: 'Episode' },
    { name: 'TVEpisode', parent: 'Episode' },
    {
      name: 'Game',
      parent: 'CreativeWork',
      type: 'game',
      collection: 'products',
    },
    { name: 'VideoGame', parent: 'Game' },
    { name: 'HowTo', parent: 'CreativeWork' },
    { name: 'Recipe', parent: 'HowTo', type: 'recipe', collection: 'works' },
    {
      name: 'JournalEntry',
      parent: 'CreativeWork',
      type: 'journal',
      collection: 'works',
      isCustom: true,
    },
    {
      name: 'MediaObject',
      parent: 'CreativeWork',
      type: 'asset',
      collection: 'assets',
    },
    { name: 'ImageObject', parent: 'CreativeWork' },
    { name: 'VideoObject', parent: 'CreativeWork' },
    { name: 'AudioObject', parent: 'CreativeWork' },
    {
      name: 'Message',
      parent: 'CreativeWork',
      type: 'message',
      collection: 'works',
    },
    {
      name: 'EmailMessage',
      parent: 'Message',
      type: 'email',
      collection: 'email',
    },
    {
      name: 'Movie',
      parent: 'CreativeWork',
      type: 'movie',
      collection: 'products',
    },
    {
      name: 'MusicPlaylist',
      parent: 'CreativeWork',
      type: 'playlist',
      collection: 'works',
    },
    {
      name: 'MusicAlbum',
      parent: 'MusicPlaylist',
      type: 'album',
      collection: 'products',
    },
    {
      name: 'MusicRecording',
      parent: 'CreativeWork',
      type: 'song',
      collection: 'products',
    },
    {
      name: 'Photograph',
      parent: 'CreativeWork',
      type: 'photo',
      collection: 'works',
    },
    {
      name: 'Play',
      parent: 'CreativeWork',
      type: 'play',
      collection: 'products',
    },
    {
      name: 'Presentation',
      parent: 'CreativeWork',
      type: 'talk',
      collection: 'works',
      isCustom: true,
    },
    {
      name: 'PublicationIssue',
      parent: 'CreativeWork',
      type: 'issue',
      collection: 'works',
    },
    {
      name: 'Quotation',
      parent: 'CreativeWork',
      type: 'quote',
      collection: 'works',
    },
    {
      name: 'Review',
      parent: 'CreativeWork',
      type: 'review',
      collection: 'works',
    },
    {
      name: 'ShortStory',
      parent: 'CreativeWork',
      type: 'story',
      collection: 'works',
    },
    {
      name: 'SoftwareApplication',
      parent: 'CreativeWork',
      type: 'app',
      collection: 'products',
    },
    {
      name: 'WebApplication',
      parent: 'SoftwareApplication',
      type: 'webapp',
      collection: 'works',
    },
    {
      name: 'SoftwareSourceCode',
      parent: 'CreativeWork',
      type: 'code',
      collection: 'works',
    },
    {
      name: 'VisualArtwork',
      parent: 'CreativeWork',
      type: 'art',
      collection: 'works',
    },
    {
      name: 'WebSite',
      parent: 'CreativeWork',
      type: 'site',
      collection: 'works',
    },
    { name: 'Event', parent: 'Thing', type: 'event', collection: 'events' },
    {
      name: 'EventSeries',
      parent: 'Event',
      type: 'events',
      collection: 'events',
    },
    {
      name: 'Engagement',
      parent: 'Event',
      type: 'engagement',
      collection: 'events',
      isCustom: true,
    },
    {
      name: 'PresentationEvent',
      parent: 'Event',
      type: 'performance',
      collection: 'events',
      isCustom: true,
    },
    { name: 'DefinedTerm', parent: 'Thing', type: 'term', collection: 'terms' },
    { name: 'Role', parent: 'Thing', type: 'role', collection: 'things' },
    { name: 'OrganizationRole', parent: 'Role' },
    {
      name: 'EmployeeRole',
      parent: 'OrganizationRole',
      type: 'job',
      collection: 'things',
    },
    {
      name: 'Organization',
      parent: 'Thing',
      type: 'org',
      collection: 'things',
    },
    { name: 'NewsMediaOrganization', parent: 'Organization' },
    { name: 'Person', parent: 'Thing', type: 'person', collection: 'things' },
    { name: 'Place', parent: 'Thing', type: 'place', collection: 'things' },
    {
      name: 'Product',
      parent: 'Thing',
      type: 'product',
      collection: 'products',
    },
    {
      name: 'HardwareDevice',
      parent: 'Product',
      type: 'device',
      collection: 'products',
      isCustom: true,
    },
  ];
}

export function getId(input: string | WithId) {
  if (typeof input === 'string' && input.indexOf(idSeparator) > -1) {
    return input.split(idSeparator)[1];
  } else if (typeof input !== 'string') {
    const output = input.id.split(idSeparator).pop();
    if (output) return output;
  }
  // We should always have a type indicator in the ID. This is borked, yo.
  throw new TypeError('Thing ID lacked required type prefix');
}

export function getRawType(input: string | WithId) {
  if (typeof input === 'string' && input.indexOf(idSeparator) > -1) {
    return input.split(idSeparator)[0];
  } else if (typeof input !== 'string') {
    return input.type;
  }
  // We should always have a type indicator in the ID. This is borked, yo.
  throw new TypeError('Thing ID lacked required type prefix');
}

export function getSchema(input: string | WithId) {
  return getMeta(getRawType(input)).name;
}

export function getType(input: string | WithId) {
  const schema = getMeta(getRawType(input));
  if (schema.type) return schema.type;
  throw new TypeError(`No type metadata found for '${input}`);
}

export function getCollection(input: string | WithId) {
  const schema = getMeta(getRawType(input));
  if (schema.collection) return schema.collection;
  throw new TypeError(`No collection metadata found for '${input}`);
}

// Get all collection/bucket names used in the schema list.
export function listCollections() {
  const rawCollections = schemas()
    .map(s => s.collection)
    .filter(s => s !== undefined);
  return [...new Set<string>(rawCollections).values()];
}
