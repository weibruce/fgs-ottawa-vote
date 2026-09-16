/**
 * 圖示集 —— 依參考稿 docs/ui/admin/*.png 的線性圖示手繪近似
 * 統一 24×24 viewBox、stroke 線性風格（strokeWidth 1.6）
 */
import type { ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

function Svg({
  children,
  size = 18,
  className,
  strokeWidth = 1.6,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/* ── 側欄 ── */

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="3.6" width="7.4" height="7.4" rx="1.7" />
    <rect x="14.4" y="3.6" width="6" height="5.2" rx="1.6" />
    <rect x="3.6" y="14.4" width="5.2" height="6" rx="1.6" />
    <rect x="12.4" y="12.4" width="8" height="8" rx="1.8" />
  </Svg>
)

export const IconMapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21.2s6.6-5.5 6.6-10.6a6.6 6.6 0 1 0-13.2 0C5.4 15.7 12 21.2 12 21.2z" />
    <circle cx="12" cy="10.4" r="2.4" />
  </Svg>
)

export const IconCandidate = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.6" cy="7.4" r="3.2" />
    <path d="M3.4 19.9c0-3.4 2.8-6.2 6.2-6.2 1 0 1.9.2 2.7.6" />
    <path d="M14.8 13.4l2.5 2.5 4.1-4.7" />
  </Svg>
)

export const IconMembers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.2" cy="7.2" r="3" />
    <path d="M3.4 19.9c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" />
    <path d="M16.5 4.9a3.3 3.3 0 0 1 0 4.8" />
    <path d="M18.6 14.4a5.7 5.7 0 0 1 2.1 4.4" />
  </Svg>
)

export const IconVoteConfig = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8.2" cy="8" r="2.2" />
    <path d="M10.4 8h10" />
    <path d="M3.6 8h2.4" />
    <circle cx="15.8" cy="16" r="2.2" />
    <path d="M3.6 16h10" />
    <path d="M18 16h2.4" />
  </Svg>
)

export const IconTally = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.8 3.8v16.4h16.4" />
    <path d="M8.6 20.2v-5.4M12.8 20.2V8.4M17 20.2v-8.2" />
  </Svg>
)

export const IconRounds = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.6" cy="18.3" r="2.2" />
    <circle cx="18.4" cy="5.7" r="2.2" />
    <path d="M5.6 4.2v11.9" />
    <path d="M7.6 17.5C11.4 15.6 14.4 12.4 16.4 8.1" />
  </Svg>
)

export const IconAppointments = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="6.4" r="3.2" />
    <path d="M8.5 11.8h7l-1.5 2.7 1.5 2.7h-7l1.5-2.7z" />
    <path d="M12 17.2v3.4" />
  </Svg>
)

export const IconExport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.4v10.2" />
    <path d="M8.2 9.8L12 13.6l3.8-3.8" />
    <path d="M4.6 16.2v2.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-2.4" />
  </Svg>
)

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.4 3.6v16.8M12 3.6v16.8M17.6 3.6v16.8" />
    <path d="M4.2 8.6h4.4M9.8 14.4h4.4M15.4 7h4.4" />
  </Svg>
)

/* ── 頂欄 ── */

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.6" />
    <path d="M20.4 20.4l-4.6-4.6" />
  </Svg>
)

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 6-2.4 7.6-2.4 7.6h16.8S18 14.6 18 8.6z" />
    <path d="M13.7 19.8a2 2 0 0 1-3.4 0" />
  </Svg>
)

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
)

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Svg>
)

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Svg>
)

/* ── 通用操作 ── */

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const IconEdit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.5 20.2H21" />
    <path d="M16.6 3.9a2 2 0 0 1 2.8 2.8L7.6 18.5l-3.8.9.9-3.8z" />
  </Svg>
)

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.8 6.4h16.4" />
    <path d="M8.6 6.4V4.6a1.4 1.4 0 0 1 1.4-1.4h4a1.4 1.4 0 0 1 1.4 1.4v1.8" />
    <path d="M6 6.4l1 13.2a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5l1-13.2" />
    <path d="M10.4 10.6v6M13.6 10.6v6" />
  </Svg>
)

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.2" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
  </Svg>
)

export const IconUnlock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="2.2" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 6.9-1.4" />
  </Svg>
)

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.4V3.8" />
    <path d="M7.6 8.2L12 3.8l4.4 4.4" />
    <path d="M4.6 15.6v2.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-2.4" />
  </Svg>
)

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.8v11.6" />
    <path d="M7.6 11L12 15.4 16.4 11" />
    <path d="M4.6 15.6v2.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-2.4" />
  </Svg>
)

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.6a8 8 0 1 0-.7 4.4" />
    <path d="M20.2 4.6v4.6h-4.6" />
  </Svg>
)

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.8 12.6l4.6 4.6L19.2 7.4" />
  </Svg>
)

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M8.4 12.2l2.6 2.6 4.6-5" />
  </Svg>
)

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.2 2" />
  </Svg>
)

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.2" />
    <path d="M3.6 10h16.8M8.4 3.4v3.6M15.6 3.4v3.6" />
  </Svg>
)

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20.2c0-3.8 3.2-6.8 7.2-6.8s7.2 3 7.2 6.8" />
  </Svg>
)

export const IconUserPlus = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.6" />
    <path d="M3 20.2c0-3.8 3.1-6.8 7-6.8 1.2 0 2.3.3 3.3.8" />
    <path d="M17.6 14.6v5.6M14.8 17.4h5.6" />
  </Svg>
)

export const IconFileText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.4 3.4H7a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
    <path d="M13.4 3.4V9H19" />
    <path d="M8.6 13h6.8M8.6 16.4h4.8" />
  </Svg>
)

export const IconQrCode = (p: IconProps) => (
  <Svg {...p} strokeWidth={p.strokeWidth ?? 1.5}>
    <rect x="3.4" y="3.4" width="6.2" height="6.2" rx="1.4" />
    <rect x="14.4" y="3.4" width="6.2" height="6.2" rx="1.4" />
    <rect x="3.4" y="14.4" width="6.2" height="6.2" rx="1.4" />
    <path d="M14.4 14.4h2.8v2.8h-2.8zM20.6 14.4v6.2h-6.2" />
  </Svg>
)

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2.2" />
    <path d="M15.4 8.6V5.8a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v7.8a2 2 0 0 0 2 2h2.8" />
  </Svg>
)

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.6 12S6.4 5.8 12 5.8 21.4 12 21.4 12 17.6 18.2 12 18.2 2.6 12 2.6 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
)

export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.6 5.4h16.8l-6.6 7.8v5.4l-3.6 2v-7.4z" />
  </Svg>
)

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.6 3.9L2.9 17.2A1.6 1.6 0 0 0 4.3 19.6h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0z" />
    <path d="M12 9.4v4M12 16.6h0" />
  </Svg>
)

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.4M12 7.8h0" />
  </Svg>
)

export const IconGrip = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6.4" r="1.2" />
    <circle cx="15" cy="6.4" r="1.2" />
    <circle cx="9" cy="12" r="1.2" />
    <circle cx="15" cy="12" r="1.2" />
    <circle cx="9" cy="17.6" r="1.2" />
    <circle cx="15" cy="17.6" r="1.2" />
  </Svg>
)

export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.6 17.4l6-6 3.6 3.6 7-7" />
    <path d="M20.2 12.4V8h-4.4" />
  </Svg>
)

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l7.2 2.8v5.6c0 4.6-3 8-7.2 9.2-4.2-1.2-7.2-4.6-7.2-9.2V6z" />
    <path d="M9.2 12l2 2 3.6-3.8" />
  </Svg>
)

export const IconBuilding = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.6 20.4V4.6a1.4 1.4 0 0 1 1.4-1.4h8a1.4 1.4 0 0 1 1.4 1.4v15.8" />
    <path d="M15.4 9.6h3.6a1.4 1.4 0 0 1 1.4 1.4v9.4" />
    <path d="M3 20.4h18M8 7h4.4M8 10.6h4.4M8 14.2h4.4" />
  </Svg>
)
