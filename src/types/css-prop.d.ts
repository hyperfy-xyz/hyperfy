import { CSSProperties } from 'react';
import { CSSProp } from '@firebolt-dev/css'

// Augment the @firebolt-dev/css module
declare module '@firebolt-dev/css' {
  export function css(strings: TemplateStringsArray, ...values: any[]): string;
}

// Create a CSS prop type
type CSSProp = string;

// Augment React types
declare module 'react' {
  // Add css to all HTML attributes
  interface HTMLAttributes<T> {
    css?: any;
  }
  
  // Add css to all SVG attributes
  interface SVGAttributes<T> {
    css?: CSSProp;
  }
  
  // Add css to DOMAttributes
  interface DOMAttributes<T> {
    css?: any;
  }
  
  // Add css to AriaAttributes
  interface AriaAttributes {
    css?: any;
  }
  
  // Add css to base Attributes
  interface Attributes {
    css?: any;
  }

  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    css?: CSSProp | undefined;
  }
}

// Extend JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      css?: any;
    }
    
    interface Element {
      props?: any & { css?: CSSProp };
    }
  }
}

// Make sure the file is treated as a module
export {}; 