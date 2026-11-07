// Keeps the observed floor, avatar floor and route resources; releases everything
// else. Late responses cannot revive a model after the view changes or disposal.
export class ModelStore<T> {
  private readonly cache = new Map<string,T>();
  private readonly pending = new Map<string,Promise<void>>();
  private wanted = new Set<string>();
  private generation = 0;
  private disposed = false;
  private readonly load: (id: string) => Promise<T>;
  private readonly release: (value: T) => void;
  constructor(load: (id: string) => Promise<T>, release: (value: T) => void) { this.load = load; this.release = release; }
  values(): T[] { return [...this.cache.values()]; }
  async sync(ids: string[]): Promise<{ current: boolean; errors: unknown[] }> {
    if (this.disposed) return { current:false,errors:[] };
    const generation = ++this.generation;
    this.wanted = new Set(ids);
    for (const [id,value] of this.cache) if (!this.wanted.has(id)) { this.release(value); this.cache.delete(id); }
    const results = await Promise.allSettled([...this.wanted].map((id) => {
      if (this.cache.has(id)) return Promise.resolve();
      if (!this.pending.has(id)) {
        const promise = this.load(id).then((value) => {
          if (this.disposed || !this.wanted.has(id)) this.release(value);
          else this.cache.set(id,value);
        }).finally(() => this.pending.delete(id));
        this.pending.set(id,promise);
      }
      return this.pending.get(id)!;
    }));
    return { current:!this.disposed && generation === this.generation, errors:results.flatMap((result) => result.status === "rejected" ? [result.reason] : []) };
  }
  dispose(): void {
    this.disposed = true; this.wanted.clear(); this.generation++;
    this.cache.forEach(this.release); this.cache.clear();
  }
}
