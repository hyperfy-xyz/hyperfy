import type { Settings as ISettings, World } from '../../types/index.js';
import { System } from './System.js';

interface SettingsData {
  title?: string | null;
  desc?: string | null;
  image?: string | null;
  model?: string | null;
  avatar?: string | null;
  public?: boolean | null;
  playerLimit?: number | null;
}

interface SettingsChange {
  prev: any;
  value: any;
}

interface SettingsChanges {
  [key: string]: SettingsChange;
}

export class Settings extends System implements ISettings {
  title: string | null = null;
  desc: string | null = null;
  image: string | null = null;
  model?: { url: string } | string | null;
  avatar: string | null = null;
  public?: boolean;
  playerLimit: number | null = null;

  private changes: SettingsChanges | null = null;

  constructor(world: World) {
    super(world);
  }

  get(key: string): any {
    return (this as any)[key];
  }

  set(key: string, value: any, broadcast = false): void {
    this.modify(key, value);
    if (broadcast && 'network' in this.world) {
      (this.world as any).network?.send('settingsModified', { key, value });
    }
  }

  deserialize(data: SettingsData): void {
    this.title = data.title ?? null;
    this.desc = data.desc ?? null;
    this.image = data.image ?? null;
    this.model = data.model ? (typeof data.model === 'string' ? data.model : { url: data.model }) : undefined;
    this.avatar = data.avatar ?? null;
    this.public = data.public === null ? undefined : data.public;
    this.playerLimit = data.playerLimit ?? null;
    
    this.emit('change', {
      title: { value: this.title },
      desc: { value: this.desc },
      image: { value: this.image },
      model: { value: this.model },
      avatar: { value: this.avatar },
      public: { value: this.public },
      playerLimit: { value: this.playerLimit },
    });
  }

  serialize(): SettingsData {
    return {
      desc: this.desc,
      title: this.title,
      image: this.image,
      model: typeof this.model === 'object' ? this.model?.url : this.model,
      avatar: this.avatar,
      public: this.public === undefined ? null : this.public,
      playerLimit: this.playerLimit,
    };
  }

  override preFixedUpdate(): void {
    if (!this.changes) return;
    this.emit('change', this.changes);
    this.changes = null;
  }

  private modify(key: string, value: any): void {
    if ((this as any)[key] === value) return;
    const prev = (this as any)[key];
    (this as any)[key] = value;
    
    if (!this.changes) this.changes = {};
    if (!this.changes[key]) this.changes[key] = { prev, value: null };
    this.changes[key].value = value;
  }


} 