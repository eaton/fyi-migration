/**
 * Stub for a document/relationship store API. `Entities` and `Relationships` will
 * be supported; both can contain full documents, and require an `_id` property
 * with a slash-delimiter separating the collection name from the document key.
 * Relationships include required `_from` and `_to` fields, each linking to another
 * document ID. `_created`, `_updated`, and `_rev` properties may also be useful.
 * 
 * I'm looking to the [Keyv](https://keyv.org) project as an example in some ways,
 * but will probably not bother supporting distinct storage backends for individual
 * collections.
 * 
 * After quite a bit of consideration, I think a global query mechanism is likely to
 * lead to horrifying scope creep. Instead, I'm shooting for a (relatively) clean 
 * iteration mechanism that all storage providers are expected to support, with
 * each storage provider being left to iron out the "best" native mechanism for a
 * query/filtered retrieval syntax.
 * 
 * Finally, explicit support for Crawlee/Apify style Key Value Store, Dataset, and
 * Queue providers would be a stretch goal — that would make it easy for Spidergram to
 * to leverage this work.
 */

import { MapLike } from "./maplike.js";


export interface StorageSystem extends MapLike {

}

export interface StorageCollection extends MapLike {

}


