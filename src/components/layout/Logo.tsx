import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('flex items-center rounded-sm text-sm leading-none font-bold tracking-[0.12em] whitespace-nowrap', className)}
      aria-label="Kurio — início">
      KURIO
    </Link>
  )
}
