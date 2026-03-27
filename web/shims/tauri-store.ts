/**
 * Web shim for @tauri-apps/plugin-store
 * Uses localStorage as backing store
 */

export class Store {
  private prefix: string;

  constructor(name: string) {
    this.prefix = `tg-drive:${name}:`;
  }

  static async load(name: string): Promise<Store> {
    return new Store(name);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async save(): Promise<void> {
    // No-op: localStorage persists automatically
  }
}

/**
 * Named export matching newer @tauri-apps/plugin-store API
 * AuthWizard uses: import { load } from '@tauri-apps/plugin-store';
 */
export async function load(name: string): Promise<Store> {
  return new Store(name);
}
