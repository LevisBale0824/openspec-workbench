// ---------------------------------------------------------------------------
// Typed Event Emitter
// ---------------------------------------------------------------------------
// Lightweight, type-safe event emitter for SSE event dispatch.
// Ported from opencode-visualizer-cn/app/utils/eventEmitter.ts
// ---------------------------------------------------------------------------

type Listener<T = unknown> = (payload: T) => void;

export class TypedEmitter<EventMap extends Record<string, unknown>> {
  private listeners = new Map<
    keyof EventMap,
    Set<Listener>
  >();

  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener);
    return () => {
      set!.delete(listener as Listener);
      if (set!.size === 0) this.listeners.delete(event);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[EventEmitter] Error in listener for "${String(event)}":`, error);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
