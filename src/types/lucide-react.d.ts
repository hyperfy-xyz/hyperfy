declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    stroke?: string;
    strokeWidth?: string | number;
    fill?: string;
    className?: string;
    absoluteStrokeWidth?: boolean;
  }
  
  export type LucideIcon = FC<LucideProps>;
  
  // Declare all the icons we're using
  export const BoxIcon: LucideIcon;
  export const CodeIcon: LucideIcon;
  export const DownloadIcon: LucideIcon;
  export const EarthIcon: LucideIcon;
  export const LayersIcon: LucideIcon;
  export const Loader2: LucideIcon;
  export const MenuIcon: LucideIcon;
  export const MessageSquareIcon: LucideIcon;
  export const MoveIcon: LucideIcon;
  export const OctagonXIcon: LucideIcon;
  export const Pin: LucideIcon;
  export const Plus: LucideIcon;
  export const SaveIcon: LucideIcon;
  export const SearchIcon: LucideIcon;
  export const SparkleIcon: LucideIcon;
  export const Square: LucideIcon;
  export const TagIcon: LucideIcon;
  export const Trash2Icon: LucideIcon;
  export const Trees: LucideIcon;
  export const Zap: LucideIcon;
  
  // Add any other icons as needed
  const icons: Record<string, LucideIcon>;
  export default icons;
} 