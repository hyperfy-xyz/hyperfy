import type { World } from '../../types';

/**
 * Remove systems that have Three.js/WebGL dependencies for testing
 */
export function removeGraphicsSystemsForTesting(world: World): void {
  const systemsToRemove = ['Physics', 'Stage', 'Graphics', 'Environment', 'Loader'];
  
  for (const systemName of systemsToRemove) {
    const index = world.systems.findIndex(s => s.constructor.name === systemName);
    if (index >= 0) {
      world.systems.splice(index, 1);
      delete (world as any)[systemName.toLowerCase()];
    }
  }
}

/**
 * Setup environment variables for testing
 */
export function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  
  // Mock browser globals that Three.js might expect
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
      requestAnimationFrame: (cb: Function) => setTimeout(cb, 16),
      cancelAnimationFrame: (id: number) => clearTimeout(id)
    };
  }
  
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      createElement: () => ({
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => null
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    };
  }
  
  // Mock WebGL context
  if (typeof globalThis.WebGLRenderingContext === 'undefined') {
    (globalThis as any).WebGLRenderingContext = class {};
  }
} 