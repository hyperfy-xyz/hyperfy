declare module '@firebolt-dev/css' {
  export function css(strings: TemplateStringsArray, ...values: any[]): any;
  
  // Extend React types to support css prop
  export {}
}

// Extend React's HTML attributes to include the css prop
declare namespace React {
  interface HTMLAttributes<T> {
    css?: any;
  }
  interface SVGAttributes<T> {
    css?: any;
  }
}

// Make css prop available on JSX intrinsic elements
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      css?: any;
    }
  }
} 