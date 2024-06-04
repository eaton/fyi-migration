import jetpack from '@eatonfyi/fs-jetpack';

export type StoreableData = string | object | Array<unknown> | Buffer;
export type StoreKey = string | number | symbol;
export type StorableDataWithKey = object & { id: StoreKey };

export interface StoreOptions {
  root?: string | typeof jetpack;
  format?: string;
}

const defaults: Required<StoreOptions> = {
  root: './storage',
  format: 'json',
};

/**
 * The absolute most jank KVS that e'r were.
 */
export class Store<T extends StoreableData = StoreableData> {
  protected root: typeof jetpack;
  protected format: string;

  constructor(options: StoreOptions = {}) {
    const opt = { ...defaults, ...options };
    this.root = typeof opt.root === 'string' ? jetpack.dir(opt.root) : opt.root;
    this.format = opt.format;
  }

  has(key: StoreKey) {
    return this.root.exists(this.asKey(key)) === 'file';
  }

  set(value: StorableDataWithKey): this;
  set(key: StoreKey, value: T): this;
  set(keyOrValue: StoreKey | StorableDataWithKey, value?: T): this {
    if (typeof keyOrValue === 'object') {
      this.root.write(this.asKey(keyOrValue.id), keyOrValue);
    } else if (value !== undefined) {
      this.root.write(this.asKey(keyOrValue), value);
    } else {
      throw new TypeError('Stored value may not be undefined.');
    }
    return this;
  }

  get(key: StoreKey) {
    return this.root.read(this.asKey(key), 'auto') as T;
  }

  delete(key: StoreKey) {
    if (this.has(key)) {
      this.root.remove(this.asKey(key));
    }
  }

  async download(key: StoreKey, url: string | URL | Request) {
    return this.root.downloadAsync(this.asKey(key), url);
  }

  bucket<S extends T = T>(name: string, format?: string) {
    return new Store<S>({
      root: this.root.dir(name),
      format: format ?? this.format,
    });
  }

  protected asKey(input: StoreKey | StoreableData) {
    // Should santize here.
    return input.toString() + '.' + this.cleanFormat;
  }

  protected get cleanFormat() {
    return this.format.toLocaleLowerCase().replace(/^\.+/, '');
  }
}
