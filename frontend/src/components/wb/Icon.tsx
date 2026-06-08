import type { ReactElement, SVGProps } from 'react'

const PATHS: Record<string, ReactElement> = {
  plus: <path d="M8 2v12M2 8h12" />,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
  back: <path d="M13 8H3M7 4L3 8l4 4" />,
  grid: <path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />,
  trash: <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" />,
  download: <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />,
  copy: <path d="M5 5V3h8v8h-2M3 5h8v8H3z" />,
  close: <path d="M3 3l10 10M13 3L3 13" />,
  undo: <path d="M5 7H10a3 3 0 0 1 0 6H6M5 7l2.5-2.5M5 7l2.5 2.5" />,
  redo: <path d="M11 7H6a3 3 0 0 0 0 6h4M11 7L8.5 4.5M11 7l-2.5 2.5" />,
  zoomIn: (
    <g>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14M7 5v4M5 7h4" />
    </g>
  ),
  zoomOut: (
    <g>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14M5 7h4" />
    </g>
  ),
  fit: <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" />,
  edit: <path d="M11 2.5l2.5 2.5M3 11l8-8.5 2.5 2.5L5 13l-2.5.5z" />,
  dots: (
    <g>
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </g>
  ),
  check: <path d="M3 8.5L6.5 12 13 4" />,
  layers: <path d="M8 2l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3" />,
  spark: <path d="M8 1.5l1.6 4.4 4.4 1.6-4.4 1.6L8 13.5 6.4 9.1 2 7.5l4.4-1.6z" />,
  search: (
    <g>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </g>
  ),
  chevron: <path d="M6 4l4 4-4 4" />,
  book: <path d="M8 3.5C6.5 2.5 4 2.5 2.5 3v9C4 11.5 6.5 11.5 8 12.5M8 3.5C9.5 2.5 12 2.5 13.5 3v9C12 11.5 9.5 11.5 8 12.5M8 3.5v9" />,
  file: <path d="M4 1.5h5l3 3V14H4zM9 1.5V5h3" />,
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: keyof typeof PATHS | (string & {})
  size?: number
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
