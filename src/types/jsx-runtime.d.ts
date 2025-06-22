// Type definitions for React JSX runtime with css prop support

declare namespace JSX {
  interface IntrinsicAttributes {
    css?: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element extends React.ReactElement<any, any> { }
  interface ElementClass extends React.Component<any> {
    render(): React.ReactNode;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}

// Augment the react/jsx-runtime
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      css?: any;
    }
  }
}

// Make TypeScript recognize css as a valid prop on all elements
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// Add css prop support for all HTML elements
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    css?: any;
  }
}

export {};
