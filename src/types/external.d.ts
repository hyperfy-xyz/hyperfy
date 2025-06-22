// Type definitions for external dependencies

// Extend React types to support css prop
declare module 'react' {
  interface HTMLAttributes<T> {
    css?: string;
  }
  
  interface SVGAttributes<T> {
    css?: string;
  }
  
  // Extend all HTML element interfaces
  interface AnchorHTMLAttributes<T> {
    css?: string;
  }
  interface AreaHTMLAttributes<T> {
    css?: string;
  }
  interface AudioHTMLAttributes<T> {
    css?: string;
  }
  interface BaseHTMLAttributes<T> {
    css?: string;
  }
  interface BlockquoteHTMLAttributes<T> {
    css?: string;
  }
  interface ButtonHTMLAttributes<T> {
    css?: string;
  }
  interface CanvasHTMLAttributes<T> {
    css?: string;
  }
  interface ColHTMLAttributes<T> {
    css?: string;
  }
  interface ColgroupHTMLAttributes<T> {
    css?: string;
  }
  interface DataHTMLAttributes<T> {
    css?: string;
  }
  interface DetailsHTMLAttributes<T> {
    css?: string;
  }
  interface DelHTMLAttributes<T> {
    css?: string;
  }
  interface DialogHTMLAttributes<T> {
    css?: string;
  }
  interface EmbedHTMLAttributes<T> {
    css?: string;
  }
  interface FieldsetHTMLAttributes<T> {
    css?: string;
  }
  interface FormHTMLAttributes<T> {
    css?: string;
  }
  interface HtmlHTMLAttributes<T> {
    css?: string;
  }
  interface IframeHTMLAttributes<T> {
    css?: string;
  }
  interface ImgHTMLAttributes<T> {
    css?: string;
  }
  interface InsHTMLAttributes<T> {
    css?: string;
  }
  interface InputHTMLAttributes<T> {
    css?: string;
  }
  interface KeygenHTMLAttributes<T> {
    css?: string;
  }
  interface LabelHTMLAttributes<T> {
    css?: string;
  }
  interface LiHTMLAttributes<T> {
    css?: string;
  }
  interface LinkHTMLAttributes<T> {
    css?: string;
  }
  interface MapHTMLAttributes<T> {
    css?: string;
  }
  interface MenuHTMLAttributes<T> {
    css?: string;
  }
  interface MediaHTMLAttributes<T> {
    css?: string;
  }
  interface MetaHTMLAttributes<T> {
    css?: string;
  }
  interface MeterHTMLAttributes<T> {
    css?: string;
  }
  interface QuoteHTMLAttributes<T> {
    css?: string;
  }
  interface ObjectHTMLAttributes<T> {
    css?: string;
  }
  interface OlHTMLAttributes<T> {
    css?: string;
  }
  interface OptgroupHTMLAttributes<T> {
    css?: string;
  }
  interface OptionHTMLAttributes<T> {
    css?: string;
  }
  interface OutputHTMLAttributes<T> {
    css?: string;
  }
  interface ParamHTMLAttributes<T> {
    css?: string;
  }
  interface ProgressHTMLAttributes<T> {
    css?: string;
  }
  interface ScriptHTMLAttributes<T> {
    css?: string;
  }
  interface SelectHTMLAttributes<T> {
    css?: string;
  }
  interface SourceHTMLAttributes<T> {
    css?: string;
  }
  interface StyleHTMLAttributes<T> {
    css?: string;
  }
  interface TableHTMLAttributes<T> {
    css?: string;
  }
  interface TextareaHTMLAttributes<T> {
    css?: string;
  }
  interface TdHTMLAttributes<T> {
    css?: string;
  }
  interface ThHTMLAttributes<T> {
    css?: string;
  }
  interface TimeHTMLAttributes<T> {
    css?: string;
  }
  interface TrackHTMLAttributes<T> {
    css?: string;
  }
  interface VideoHTMLAttributes<T> {
    css?: string;
  }
  
  // Base React types
  export interface Context<T> {
    Provider: any;
    Consumer: any;
  }
  
  export type Reducer<S, A> = (prevState: S, action: A) => S;
  export type ReducerState<R> = R extends Reducer<infer S, any> ? S : never;
  export type ReducerAction<R> = R extends Reducer<any, infer A> ? A : never;
  export type Dispatch<A> = (value: A) => void;
  
  // Export hooks and functions
  export function createContext<T>(defaultValue?: T): Context<T>;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useContext<T>(context: Context<T>): T;
  export function useReducer<R extends Reducer<any, any>>(
    reducer: R,
    initialArg: ReducerState<R>,
    init?: (arg: ReducerState<R>) => ReducerState<R>
  ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
  
  // Export types
  export type ReactElement<P = any> = {
    type: any;
    props: P;
    key: string | number | null;
  };
  
  export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNode[];
  
  export interface Component<P = {}> {
    props: Readonly<P>;
    render(): ReactNode;
  }
  
  export type ComponentClass<P = {}> = new (props: P) => Component<P>;
  export type FunctionComponent<P = {}> = (props: P) => ReactElement | null;
  export type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  
  export interface CSSProperties {
    [key: string]: any;
  }
  
  // Export event types
  export interface ChangeEvent<T = Element> {
    target: EventTarget & T;
  }
  
  export interface MouseEvent<T = Element> {
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
    button: number;
    buttons: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    currentTarget: EventTarget & T;
    preventDefault(): void;
    stopPropagation(): void;
  }
}

// lucide-react icons
declare module 'lucide-react' {
  interface IconProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    fill?: string;
    className?: string;
    style?: React.CSSProperties;
  }
  
  type Icon = React.ComponentType<IconProps>;
  
  export const AlertCircleIcon: Icon;
  export const AlertTriangleIcon: Icon;
  export const AnchorIcon: Icon;
  export const ArrowDownIcon: Icon;
  export const ArrowUpIcon: Icon;
  export const AsteriskIcon: Icon;
  export const AtomIcon: Icon;
  export const AudioLinesIcon: Icon;
  export const BellIcon: Icon;
  export const BlendIcon: Icon;
  export const BoxIcon: Icon;
  export const BrickWallIcon: Icon;
  export const BugIcon: Icon;
  export const CheckIcon: Icon;
  export const ChevronDownIcon: Icon;
  export const ChevronLeftIcon: Icon;
  export const ChevronRightIcon: Icon;
  export const CircleIcon: Icon;
  export const CircleCheckIcon: Icon;
  export const ClockIcon: Icon;
  export const CodeIcon: Icon;
  export const CogIcon: Icon;
  export const CopyIcon: Icon;
  export const CrosshairIcon: Icon;
  export const CubeIcon: Icon;
  export const DownloadIcon: Icon;
  export const DumbbellIcon: Icon;
  export const EarthIcon: Icon;
  export const EditIcon: Icon;
  export const ExpandIcon: Icon;
  export const EyeIcon: Icon;
  export const EyeOffIcon: Icon;
  export const FileIcon: Icon;
  export const FileCode2Icon: Icon;
  export const FolderIcon: Icon;
  export const GaugeIcon: Icon;
  export const GridIcon: Icon;
  export const HardDriveIcon: Icon;
  export const HashIcon: Icon;
  export const HelpCircleIcon: Icon;
  export const HomeIcon: Icon;
  export const InfoIcon: Icon;
  export const LandmarkIcon: Icon;
  export const LayersIcon: Icon;
  export const LightbulbIcon: Icon;
  export const LinkIcon: Icon;
  export const ListIcon: Icon;
  export const LoaderIcon: Icon;
  export const LockIcon: Icon;
  export const LockKeyholeIcon: Icon;
  export const LogInIcon: Icon;
  export const LogOutIcon: Icon;
  export const MagnetIcon: Icon;
  export const MapIcon: Icon;
  export const MenuIcon: Icon;
  export const MessageSquareIcon: Icon;
  export const MicIcon: Icon;
  export const MicOffIcon: Icon;
  export const MinusIcon: Icon;
  export const MoonIcon: Icon;
  export const MoreHorizontalIcon: Icon;
  export const MoreVerticalIcon: Icon;
  export const MoveIcon: Icon;
  export const MousePointerIcon: Icon;
  export const MouseIcon: Icon;
  export const OctagonXIcon: Icon;
  export const PackageIcon: Icon;
  export const PackageCheckIcon: Icon;
  export const PaintBucketIcon: Icon;
  export const PaletteIcon: Icon;
  export const PersonStandingIcon: Icon;
  export const PlayIcon: Icon;
  export const PlusIcon: Icon;
  export const RefreshCwIcon: Icon;
  export const RotateCwIcon: Icon;
  export const Rows3Icon: Icon;
  export const SaveIcon: Icon;
  export const SearchIcon: Icon;
  export const SettingsIcon: Icon;
  export const ShieldIcon: Icon;
  export const ShieldOffIcon: Icon;
  export const ShuffleIcon: Icon;
  export const ShrinkIcon: Icon;
  export const SlidersIcon: Icon;
  export const SparkleIcon: Icon;
  export const SparklesIcon: Icon;
  export const SplitIcon: Icon;
  export const SunIcon: Icon;
  export const TagIcon: Icon;
  export const TargetIcon: Icon;
  export const TerminalIcon: Icon;
  export const TrashIcon: Icon;
  export const Trash2Icon: Icon;
  export const TriangleIcon: Icon;
  export const TypeIcon: Icon;
  export const UnlockIcon: Icon;
  export const UploadIcon: Icon;
  export const UserIcon: Icon;
  export const VideoIcon: Icon;
  export const VolumeIcon: Icon;
  export const Volume2Icon: Icon;
  export const VolumeXIcon: Icon;
  export const WifiIcon: Icon;
  export const WifiOffIcon: Icon;
  export const XIcon: Icon;
  export const ZapIcon: Icon;
  export const ZoomInIcon: Icon;
  export const ZoomOutIcon: Icon;
  export const ChevronUpIcon: Icon;
}

// lodash-es
declare module 'lodash-es' {
  export function orderBy<T>(
    collection: T[] | null | undefined,
    iteratees?: Array<((value: T) => any) | string> | string,
    orders?: Array<'asc' | 'desc'> | 'asc' | 'desc'
  ): T[];
  
  export function isString(value: any): value is string;
  export function isArray(value: any): value is any[];
  export function isFunction(value: any): value is Function;
  export function isNumber(value: any): value is number;
  export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
    }
  ): T & {
    cancel(): void;
    flush(): void;
  };
}

// moment
declare module 'moment' {
  const moment: any;
  export default moment;
}

// Global declarations
declare const monaco: any;

// PhysX declarations
declare const PHYSX: any; 