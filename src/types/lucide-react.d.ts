declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number
  }
  
  export type Icon = FC<IconProps>
  
  // Common icons - add more as needed
  export const Settings: Icon
  export const SettingsIcon: Icon
  export const Sun: Icon
  export const User: Icon
  export const Volume2: Icon
  export const X: Icon
  export const XIcon: Icon
  export const ZapIcon: Icon
  export const Zap: Icon
  export const Trash2Icon: Icon
  export const DownloadIcon: Icon
  export const BoxIcon: Icon
  export const FileCode2Icon: Icon
  export const CircleCheckIcon: Icon
  export const EarthIcon: Icon
  export const LockKeyholeIcon: Icon
  export const SparkleIcon: Icon
  export const LayersIcon: Icon
  export const CircleIcon: Icon
  export const FolderIcon: Icon
  export const DumbbellIcon: Icon
  export const BlendIcon: Icon
  export const EyeIcon: Icon
  export const EyeOffIcon: Icon
  export const PersonStandingIcon: Icon
  export const MagnetIcon: Icon
  export const ChevronLeftIcon: Icon
  export const ChevronRightIcon: Icon
  export const ChevronDownIcon: Icon
  export const UploadIcon: Icon
  export const LoaderIcon: Icon
  export const Loader2: Icon
  export const BrickWallIcon: Icon
  export const CrosshairIcon: Icon
  export const HardDriveIcon: Icon
  export const HashIcon: Icon
  export const OctagonXIcon: Icon
  export const TriangleIcon: Icon
  export const RotateCwIcon: Icon
  export const SearchIcon: Icon
  export const MessageSquareIcon: Icon
  export const RefreshCwIcon: Icon
  export const CodeIcon: Icon
  export const MenuIcon: Icon
  export const MoveIcon: Icon
  export const Pin: Icon
  export const Plus: Icon
  export const SaveIcon: Icon
  export const Square: Icon
  export const TagIcon: Icon
  export const Trees: Icon
  export const Rows3Icon: Icon
  
  // Allow for any other icon imports
  const icons: { [key: string]: Icon }
  export default icons
} 