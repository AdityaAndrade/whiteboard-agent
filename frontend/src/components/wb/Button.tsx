import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'ghost' | 'soft' | 'primary' | 'line'
  size?: 'm' | 's'
  icon?: string
}

export function Btn({ kind = 'ghost', size = 'm', icon, children, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${kind} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 's' ? 13 : 15} />}
      {children && <span>{children}</span>}
    </button>
  )
}
