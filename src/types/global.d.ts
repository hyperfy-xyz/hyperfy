// Global type declarations

// Global PHYSX declaration
declare const PHYSX: any;

// Extend Window interface
declare global {
  interface Window {
    app?: any;
    require?: any;
    monaco?: any;
  }
}

// CSS-in-JS support for @firebolt-dev/css
declare module 'react' {
  interface HTMLAttributes<T> {
    css?: any;
  }
  interface SVGAttributes<T> {
    css?: any;
  }
}

// Fix for storage module
declare module '*/storage' {
  export const storage: {
    get(key: string, defaultValue?: any): any;
    set(key: string, value: any): void;
  };
}

export {}; 