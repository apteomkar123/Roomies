import type { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
  dark?: boolean
  onClick?: () => void
}

export default function GlassPanel({ children, className = '', style, dark, onClick }: Props) {
  return (
    <div
      className={`${dark ? 'glass-dark' : 'glass'} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
