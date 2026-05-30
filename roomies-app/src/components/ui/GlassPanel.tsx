import type { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
  dark?: boolean
  onClick?: () => void
  id?: string
}

export default function GlassPanel({ children, className = '', style, dark, onClick, id }: Props) {
  return (
    <div
      id={id}
      className={`${dark ? 'glass-dark' : 'glass'} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
