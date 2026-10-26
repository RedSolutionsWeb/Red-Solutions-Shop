import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button({
  variant = 'secondary',
  block,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  const cls = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ')
  return <button className={cls} {...rest} />
}
