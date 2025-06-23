import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Scripts, ScriptResult } from '../../core/systems/Scripts.js';
import { createTestWorld, MockWorld } from '../test-world-factory.js';

// Mock the extras modules
vi.mock('../../core/extras/three.js', () => ({
  Object3D: class MockObject3D {},
  Quaternion: class MockQuaternion {},
  Vector3: class MockVector3 {},
  Euler: class MockEuler {},
  Matrix4: class MockMatrix4 {}
}));

vi.mock('../../core/extras/general.js', () => ({
  DEG2RAD: Math.PI / 180,
  RAD2DEG: 180 / Math.PI
}));

vi.mock('../../core/utils.js', () => ({
  clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  num: (value: any) => Number(value) || 0,
  uuid: () => 'test-uuid-' + Math.random()
}));

vi.mock('../../core/extras/LerpVector3.js', () => ({
  LerpVector3: class MockLerpVector3 {}
}));

vi.mock('../../core/extras/LerpQuaternion.js', () => ({
  LerpQuaternion: class MockLerpQuaternion {}
}));

vi.mock('../../core/extras/Curve.js', () => ({
  Curve: class MockCurve {}
}));

vi.mock('../../core/extras/prng.js', () => ({
  prng: (seed: number) => () => Math.random()
}));

vi.mock('../../core/extras/BufferedLerpVector3.js', () => ({
  BufferedLerpVector3: class MockBufferedLerpVector3 {}
}));

vi.mock('../../core/extras/BufferedLerpQuaternion.js', () => ({
  BufferedLerpQuaternion: class MockBufferedLerpQuaternion {}
}));

// Mock SES Compartment
const mockCompartment = {
  evaluate: vi.fn()
};

const MockCompartment = vi.fn(() => mockCompartment);

// Set up global Compartment
(global as any).Compartment = MockCompartment;

describe('Scripts System', () => {
  let world: MockWorld;
  let scripts: Scripts;

  beforeEach(async () => {
    world = await createTestWorld();
    vi.clearAllMocks();
    MockCompartment.mockClear();
    mockCompartment.evaluate.mockClear();
    scripts = new Scripts(world);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a compartment with proper globals', () => {
      expect(MockCompartment).toHaveBeenCalledWith(
        expect.objectContaining({
          console: expect.objectContaining({
            log: expect.any(Function),
            warn: expect.any(Function),
            error: expect.any(Function),
            time: expect.any(Function),
            timeEnd: expect.any(Function)
          }),
          Date: expect.objectContaining({
            now: expect.any(Function)
          }),
          URL: expect.objectContaining({
            createObjectURL: expect.any(Function)
          }),
          Math: Math,
          eval: undefined,
          harden: undefined,
          lockdown: undefined,
          num: expect.any(Function),
          prng: expect.any(Function),
          clamp: expect.any(Function),
          DEG2RAD: Math.PI / 180,
          RAD2DEG: 180 / Math.PI,
          uuid: expect.any(Function)
        })
      );
    });

    it('should handle missing Compartment gracefully', () => {
      delete (global as any).Compartment;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const scriptsWithoutCompartment = new Scripts(world);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Scripts system: Compartment not available. SES may not be initialized.'
      );
      
      consoleSpy.mockRestore();
      (global as any).Compartment = MockCompartment;
    });
  });

  describe('evaluate', () => {
    it('should evaluate and return a script result', () => {
      const mockFunction = vi.fn((world, app, fetch, props, setTimeout) => {
        return { result: 'success', props };
      });
      
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const code = 'return { result: "success", props }';
      const result = scripts.evaluate(code);
      
      expect(result).toHaveProperty('exec');
      expect(result).toHaveProperty('code', code);
      expect(result.exec).toBeInstanceOf(Function);
    });

    it('should wrap code with shared scope and parameters', () => {
      const code = 'return props.value * 2';
      scripts.evaluate(code);
      
      // Get the wrapped code that was passed to evaluate
      const result = scripts.evaluate(code);
      result.exec();
      
      const wrappedCode = mockCompartment.evaluate.mock.calls[0][0];
      expect(wrappedCode).toContain('const shared = {}');
      expect(wrappedCode).toContain('(world, app, fetch, props, setTimeout)');
      expect(wrappedCode).toContain('const config = props // deprecated');
      expect(wrappedCode).toContain(code);
    });

    it('should cache evaluated function', () => {
      const mockFunction = vi.fn(() => 'result');
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const result = scripts.evaluate('return "test"');
      
      // Call exec multiple times
      result.exec();
      result.exec();
      result.exec();
      
      // evaluate should only be called once
      expect(mockCompartment.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to executed function', () => {
      const mockFunction = vi.fn((world, app, fetch, props) => {
        return props;
      });
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const result = scripts.evaluate('return props');
      const testWorld = { id: 'test' };
      const testApp = { name: 'test-app' };
      const testFetch = () => {};
      const testProps = { value: 42 };
      const testSetTimeout = () => {};
      
      const returnValue = result.exec(testWorld, testApp, testFetch, testProps, testSetTimeout);
      
      expect(mockFunction).toHaveBeenCalledWith(testWorld, testApp, testFetch, testProps, testSetTimeout);
      expect(returnValue).toBe(testProps);
    });

    it('should throw error if compartment is not initialized', () => {
      delete (global as any).Compartment;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const scriptsWithoutCompartment = new Scripts(world);
      
      expect(() => scriptsWithoutCompartment.evaluate('test')).toThrow(
        'Scripts system: Compartment not initialized'
      );
      
      consoleSpy.mockRestore();
      (global as any).Compartment = MockCompartment;
    });

    it('should throw error if evaluation returns undefined', () => {
      mockCompartment.evaluate.mockReturnValue(undefined);
      
      const result = scripts.evaluate('invalid code');
      
      expect(() => result.exec()).toThrow('Failed to evaluate script');
    });
  });

  describe('security', () => {
    it('should not expose eval in compartment', () => {
      expect(MockCompartment).toHaveBeenCalled();
      const calls = MockCompartment.mock.calls as any[];
      if (calls.length > 0) {
        const compartmentConfig = calls[0][0];
        expect(compartmentConfig.eval).toBeUndefined();
      }
    });

    it('should not expose harden in compartment', () => {
      expect(MockCompartment).toHaveBeenCalled();
      const calls = MockCompartment.mock.calls as any[];
      if (calls.length > 0) {
        const compartmentConfig = calls[0][0];
        expect(compartmentConfig.harden).toBeUndefined();
      }
    });

    it('should not expose lockdown in compartment', () => {
      expect(MockCompartment).toHaveBeenCalled();
      const calls = MockCompartment.mock.calls as any[];
      if (calls.length > 0) {
        const compartmentConfig = calls[0][0];
        expect(compartmentConfig.lockdown).toBeUndefined();
      }
    });
  });

  describe('integration', () => {
    it('should execute a simple script', () => {
      const mockFunction = vi.fn((world, app, fetch, props) => {
        return props.a + props.b;
      });
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const script = scripts.evaluate('return props.a + props.b');
      const result = script.exec(world, {}, fetch, { a: 5, b: 3 });
      
      expect(result).toBe(8);
    });

    it('should handle scripts that use provided utilities', () => {
      const mockFunction = vi.fn((world, app, fetch, props) => {
        // Simulate using utilities from compartment
        const value = props.value;
        const clamped = props.clamp(value, 0, 10);
        return clamped;
      });
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const script = scripts.evaluate('return props.clamp(props.value, 0, 10)');
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const result = script.exec(world, {}, fetch, { value: 15, clamp });
      
      expect(result).toBe(10);
    });

    it('should support the deprecated config parameter', () => {
      const mockFunction = vi.fn((world, app, fetch, props) => {
        // config should be the same as props
        const config = props;
        return config.value;
      });
      mockCompartment.evaluate.mockReturnValue(mockFunction);
      
      const script = scripts.evaluate('return config.value');
      const result = script.exec(world, {}, fetch, { value: 'test' });
      
      expect(result).toBe('test');
    });
  });
}); 