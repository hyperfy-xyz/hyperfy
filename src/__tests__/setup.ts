import { expect, beforeAll, vi } from 'vitest';
import type { Vector3, Quaternion } from 'three';

// Mock WebGL context for headless testing
beforeAll(() => {
  // Create a mock WebGL context
  const mockWebGLContext = {
    getParameter: vi.fn(() => 1024),
    getExtension: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
  };

  // Mock canvas.getContext
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
      return mockWebGLContext;
    }
    return null;
  }) as any;

  // Mock requestAnimationFrame for physics simulations
  global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(() => callback(Date.now()), 16); // 60fps
  }) as any;

  global.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  }) as any;

  // Mock performance.now for accurate timing
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
  };
});

// Custom matchers for game engine testing
interface CustomMatchers<R = unknown> {
  toBeNearVector(expected: Vector3, precision?: number): R;
  toBeNearQuaternion(expected: Quaternion, precision?: number): R;
  toBeInWorld(world: any): R;
  toHaveComponent(componentType: string): R;
  toBeWithinBounds(min: Vector3, max: Vector3): R;
  toHaveVelocityMagnitude(min: number, max: number): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeNearVector(received: any, expected: any, precision = 0.001) {
    const pass = 
      Math.abs(received.x - expected.x) < precision &&
      Math.abs(received.y - expected.y) < precision &&
      Math.abs(received.z - expected.z) < precision;

    return {
      pass,
      message: () => 
        pass
          ? `Expected ${JSON.stringify(received)} not to be near ${JSON.stringify(expected)}`
          : `Expected ${JSON.stringify(received)} to be near ${JSON.stringify(expected)} (precision: ${precision})`,
    };
  },

  toBeNearQuaternion(received: any, expected: any, precision = 0.001) {
    const pass = 
      Math.abs(received.x - expected.x) < precision &&
      Math.abs(received.y - expected.y) < precision &&
      Math.abs(received.z - expected.z) < precision &&
      Math.abs(received.w - expected.w) < precision;

    return {
      pass,
      message: () => 
        pass
          ? `Expected quaternion not to be near ${JSON.stringify(expected)}`
          : `Expected quaternion to be near ${JSON.stringify(expected)} (precision: ${precision})`,
    };
  },

  toBeInWorld(entity: any, world: any) {
    const pass = world.entities.has(entity.id) || world.entities.items.has(entity.id);
    return {
      pass,
      message: () => 
        pass
          ? `Expected entity ${entity.id} not to be in world`
          : `Expected entity ${entity.id} to be in world`,
    };
  },

  toHaveComponent(entity: any, componentType: string) {
    const pass = entity.components && entity.components.has(componentType);
    return {
      pass,
      message: () => 
        pass
          ? `Expected entity not to have component ${componentType}`
          : `Expected entity to have component ${componentType}`,
    };
  },

  toBeWithinBounds(position: any, min: any, max: any) {
    const pass = 
      position.x >= min.x && position.x <= max.x &&
      position.y >= min.y && position.y <= max.y &&
      position.z >= min.z && position.z <= max.z;

    return {
      pass,
      message: () => 
        pass
          ? `Expected position not to be within bounds`
          : `Expected position ${JSON.stringify(position)} to be within bounds [${JSON.stringify(min)}, ${JSON.stringify(max)}]`,
    };
  },

  toHaveVelocityMagnitude(velocity: any, min: number, max: number) {
    const magnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const pass = magnitude >= min && magnitude <= max;

    return {
      pass,
      message: () => 
        pass
          ? `Expected velocity magnitude not to be between ${min} and ${max}`
          : `Expected velocity magnitude ${magnitude} to be between ${min} and ${max}`,
    };
  },
});

// Global test utilities
export const testUtils = {
  // Wait for physics to settle
  async waitForPhysics(world: any, frames = 10): Promise<void> {
    for (let i = 0; i < frames; i++) {
      world.tick(16);
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  },

  // Create a test position
  createPosition(x = 0, y = 0, z = 0) {
    return { x, y, z };
  },

  // Create a test quaternion
  createQuaternion(x = 0, y = 0, z = 0, w = 1) {
    return { x, y, z, w };
  },

  // Measure performance
  async measurePerformance(fn: () => void | Promise<void>, iterations = 100): Promise<number> {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    return (performance.now() - start) / iterations;
  },
}; 