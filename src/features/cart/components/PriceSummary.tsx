import type { AppliedCoupon, PriceSummary as Summary } from '@/contracts'
import { formatEth, isZeroEth } from '@/lib/eth'
import { Skeleton } from '@/components/ui/skeleton'

export function PriceSummaryList({
  summary,
  coupon,
  feeLabel = 'Taxa de rede',
}: {
  summary: Summary
  coupon: AppliedCoupon | null
  feeLabel?: string
}) {
  return (
    <dl className="flex flex-col gap-3 text-xs md:text-sm" data-testid="price-summary">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd data-testid="summary-subtotal">{formatEth(summary.subtotalEth)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Desconto{coupon ? ` (${coupon.code} · ${coupon.percentOff}%)` : ''}</dt>
        <dd data-testid="summary-discount">
          {isZeroEth(summary.discountEth) ? formatEth('0') : `− ${formatEth(summary.discountEth)}`}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{feeLabel}</dt>
        <dd data-testid="summary-fee">{formatEth(summary.networkFeeEth)}</dd>
      </div>
      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-3 text-sm font-bold md:text-base">
        <dt>Total</dt>
        <dd className="text-primary" data-testid="summary-total">{formatEth(summary.totalEth)}</dd>
      </div>
    </dl>
  )
}

export function PriceSummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-border pt-4">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-32" />
      </div>
    </div>
  )
}
