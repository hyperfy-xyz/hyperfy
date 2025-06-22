// Type fixes for Sidebar.tsx

import * as THREE from 'three';

// Extend THREE.js Euler to accept number array
declare module 'three' {
  interface Euler {
    fromArray(array: number[]): Euler;
  }
}

// Fix for storage module if not already fixed
declare module '../../core/storage' {
  export const storage: {
    get(key: string, defaultValue?: any): any;
    set(key: string, value: any): void;
  } | undefined;
}

// Add missing properties to fields
declare module './Fields' {
  export interface FieldCurveProps {
    label: string;
    hint?: string;
    x?: string;
    xRange?: number;
    y?: string;
    yMin?: number;
    yMax?: number;
    value: any;
    onChange: (value: string) => void;
  }
} 