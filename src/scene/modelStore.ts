// Keeps required resources plus a bounded LRU of recently viewed/prefetched models.
// Unused models stay inactive; late responses cannot revive a disposed store.
export class ModelStore<T> {
  private readonly cache = new Map<string,T>();
  private readonly pending = new Map<string,Promise<void>>();
  private wanted = new Set<string>();
  private generation = 0;
  private disposed = false;
  private readonly load: (id: string) => Promise<T>;
  private readonly release: (value: T) => void;
  private readonly retainUnused: number;
  constructor(load: (id: string) => Promise<T>, release: (value: T) => void, retainUnused = 0) {
    this.load = load; this.release = release; this.retainUnused = Math.max(0, Math.floor(retainUnused));
  }
  values(): T[] { return [...this.cache.values()]; }
  private trim(): void {
    const unused = [...this.cache.keys()].filter(id => !this.wanted.has(id));
    for (const id of unused.slice(0, Math.max(0, unused.length - this.retainUnused))) {
      this.release(this.cache.get(id)!); this.cache.delete(id);
    }
  }
  private ensure(id: string): Promise<void> {
    const cached = this.cache.get(id);
    if (cached !== undefined) { this.cache.delete(id); this.cache.set(id,cached); return Promise.resolve(); }
    if (!this.pending.has(id)) {
      const promise = this.load(id).then(value => {
        if (this.disposed || (!this.wanted.has(id) && !this.retainUnused)) this.release(value);
        else { this.cache.set(id,value); this.trim(); }
      }).finally(() => this.pending.delete(id));
      this.pending.set(id,promise);
    }
    return this.pending.get(id)!;
  }
  async prefetch(ids: string[]): Promise<void> {
    if (this.disposed || !this.retainUnused) return;
    // Background work never changes the current view or invalidates an active sync.
    for (const id of ids.slice(0,this.retainUnused)) {
      if (this.disposed) break;
      await this.ensure(id);
    }
  }
  async sync(ids: string[]): Promise<{ current: boolean; errors: unknown[] }> {
    if (this.disposed) return { current:false,errors:[] };
    const generation = ++this.generation;
    this.wanted = new Set(ids);
    this.trim();
    const results = await Promise.allSettled([...this.wanted].map(id => this.ensure(id)));
    return { current:!this.disposed && generation === this.generation, errors:results.flatMap((result) => result.status === "rejected" ? [result.reason] : []) };
  }
  dispose(): void {
    this.disposed = true; this.wanted.clear(); this.generation++;
    this.cache.forEach(this.release); this.cache.clear();
  }
}
