import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

const TABS = [
  { to: '/conta/perfil', label: 'Perfil' },
  { to: '/conta/carteiras', label: 'Carteiras' },
  { to: '/conta/favoritos', label: 'Favoritos' },
] as const

export function AccountLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container-page py-8 md:py-14">
      <h1 className="mb-6 text-[28px] font-semibold md:text-[38px]">{title}</h1>
      <nav aria-label="Seções da conta" className="mb-8 border-b border-border">
        <ul className="-mb-px flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <li key={t.to}>
              <Link
                to={t.to}
                className="inline-block border-b-2 border-transparent px-4 py-3 font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground"
                activeProps={{ className: 'border-primary! text-foreground!', 'aria-current': 'page' }}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  )
}
