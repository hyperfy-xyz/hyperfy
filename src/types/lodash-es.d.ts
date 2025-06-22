declare module 'lodash-es' {
  export function cloneDeep<T>(value: T): T;
  export function isBoolean(value: any): value is boolean;
  export function isEqual(value: any, other: any): boolean;
  export function merge<T, U>(object: T, ...sources: U[]): T & U;
  export function isString(value: any): value is string;
  export function isNumber(value: any): value is number;
  export function isFunction(value: any): value is Function;
  export function isArray(value: any): value is any[];
  export function every<T>(collection: T[], predicate: (value: T) => boolean): boolean;
  export function throttle<T extends (...args: any[]) => any>(
    func: T, 
    wait?: number,
    options?: { leading?: boolean; trailing?: boolean }
  ): T;
} 