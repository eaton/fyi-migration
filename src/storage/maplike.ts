export interface MapLike<T = unknown> {
  /**
   * Removes all items in the MapLike.
   */
  clear(): Promise<number>;

  /**
   * @returns true if an element in the MapLike existed and has been removed, or false if the element does not exist.
   */
  delete(key: string): Promise<boolean>;

  /**
   * @returns Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.
   */
  get(key: string): Promise<T | undefined>;

  /**
   * @returns boolean indicating whether an element with the specified key exists or not.
   */
  has(key: string): Promise<boolean>;

  /**
   * Adds a new element with a specified key and value to the MapLike. If an element with the same key already exists and `update` is `true`, the element will be updated.
   */
  set(key: string, value: T, update: boolean): Promise<this>;

  /**
   * @returns the number of elements in the MapLike.
   */
  readonly size: Promise<number>;
}
