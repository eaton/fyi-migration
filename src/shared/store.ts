import jetpack from '@eatonfyi/fs-jetpack';

export type StoreableData = string | object | Array<unknown> | Buffer;
export type StoreKey = string | number | symbol;

/**
 * The absolute most jank KVS that e'r were.
 */
export class Store<T extends StoreableData = StoreableData> {
  protected root: typeof jetpack;

  constructor(
    rootDir: string | typeof jetpack,
    protected readable = false,
  ) {
    this.root = typeof rootDir === 'string' ? jetpack.dir(rootDir) : rootDir;
  }

  has(key: StoreKey) {
    return this.root.exists(asKey(key)) === 'file';
  }

  set(key: StoreKey, value: T) {
    this.root.write(asKey(key), value, { jsonIndent: this.readable ? 2 : 0 });
  }

  get(key: StoreKey) {
    return this.root.read(asKey(key), 'auto') as T;
  }

  delete(key: StoreKey) {
    if (this.has(key)) {
      this.root.remove(asKey(key));
    }
  }

  async download(key: StoreKey, url: string | URL | Request) {
    return this.root.downloadAsync(asKey(key), url);
  }

  bucket<S extends T = T>(name: string) {
    return new Store<S>(this.root.dir(name), this.readable);
  }
}

function asKey(input: StoreKey) {
  // Should santize here.
  return input.toString() + '.json';
}
