import { System } from './System.js';
import * as THREE from '../extras/three.js';
import { DEG2RAD, RAD2DEG } from '../extras/general.js';
import { clamp, num, uuid } from '../utils.js';
import { LerpVector3 } from '../extras/LerpVector3.js';
import { LerpQuaternion } from '../extras/LerpQuaternion.js';
import { Curve } from '../extras/Curve.js';
import { prng } from '../extras/prng.js';
import { BufferedLerpVector3 } from '../extras/BufferedLerpVector3.js';
import { BufferedLerpQuaternion } from '../extras/BufferedLerpQuaternion.js';
import type { World } from '../../types/index.js';

// SES global Compartment - available after lockdown()
declare const Compartment: any;

/**
 * Script System
 *
 * - Runs on both the server and client.
 * - Executes scripts inside secure compartments
 *
 */

export interface ScriptResult {
  exec: (...args: any[]) => any;
  code: string;
}

export class Scripts extends System {
  private compartment: any;

  constructor(world: World) {
    super(world);
    
    // Check if Compartment is available (SES needs to be initialized)
    if (typeof Compartment === 'undefined') {
      // Only warn on server side where scripts are expected to be sandboxed
      if (typeof window === 'undefined') {
        console.warn('Scripts system: Compartment not available. SES may not be initialized.');
      }
      return;
    }

    this.compartment = new Compartment({
      console: {
        log: (...args: any[]) => console.log(...args),
        warn: (...args: any[]) => console.warn(...args),
        error: (...args: any[]) => console.error(...args),
        time: (...args: any[]) => console.time(...args),
        timeEnd: (...args: any[]) => console.timeEnd(...args),
      },
      Date: {
        now: () => Date.now(),
      },
      URL: {
        createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
      },
      Math,
      eval: undefined,
      harden: undefined,
      lockdown: undefined,
      num,
      prng,
      clamp,
      // Layers,
      Object3D: THREE.Object3D,
      Quaternion: THREE.Quaternion,
      Vector3: THREE.Vector3,
      Euler: THREE.Euler,
      Matrix4: THREE.Matrix4,
      LerpVector3, // deprecated - use BufferedLerpVector3
      LerpQuaternion, // deprecated - use BufferedLerpQuaternion
      BufferedLerpVector3,
      BufferedLerpQuaternion,
      // Material: Material,
      Curve,
      // Gradient: Gradient,
      DEG2RAD,
      RAD2DEG,
      uuid,
      // pause: () => this.world.pause(),
    });
  }

  evaluate(code: string): ScriptResult {
    if (!this.compartment) {
      // Fallback to unsafe evaluation on client side
      console.warn('Scripts: Using unsafe evaluation (no SES sandbox)');
      return {
        exec: (...args: any[]) => {
          // Create a basic evaluation context
          const wrappedCode = wrapRawCode(code);
          const evalFunc = new Function('return ' + wrappedCode)();
          return evalFunc(...args);
        },
        code,
      };
    }

    let value: ((...args: any[]) => any) | undefined;
    
    const result: ScriptResult = {
      exec: (...args: any[]) => {
        if (!value) {
          value = this.compartment.evaluate(wrapRawCode(code));
        }
        if (!value) {
          throw new Error('Failed to evaluate script');
        }
        return value(...args);
      },
      code,
    };
    
    return result;
  }
}

// NOTE: config is deprecated and renamed to props
function wrapRawCode(code: string): string {
  return `
  (function() {
    const shared = {}
    return (world, app, fetch, props, setTimeout) => {
      const config = props // deprecated
      ${code}
    }
  })()
  `;
} 