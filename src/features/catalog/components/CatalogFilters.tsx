import { useState, type FormEvent } from 'react'
import type { AvailabilityFilter, CategoryId } from '@/contracts'
import { CATEGORIES } from '@/contracts'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NativeSelect } from '@/components/NativeSelect'
import { cn } from '@/lib/utils'
import type { HomeSearch } from '@/routes/search'
import { useFacets } from '../hooks'

interface CatalogFiltersProps {
  search: HomeSearch
  onChange: (patch: Partial<HomeSearch>) => void
  idPrefix: string
}

const STATUS_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'soldout', label: 'Esgotados' },
]

const sectionTitle = 'mb-3 text-sm font-medium'
const row = 'flex items-center gap-2.5 text-xs'

/** Arredonda para 2 casas na direção indicada (os limites do slider sempre contêm a faixa real). */
const round2 = (value: string, dir: 'down' | 'up') => {
  const n = Number(value) * 100
  return (dir === 'down' ? Math.floor(n) : Math.ceil(n)) / 100
}

function PriceRange({ search, onChange, idPrefix }: CatalogFiltersProps) {
  const { data: facets } = useFacets()
  const floor = facets ? round2(facets.priceRange.min, 'down') : 0
  const ceil = facets ? round2(facets.priceRange.max, 'up') : 0
  const fromUrl = (): [number, number] => [
    search.min ? Math.max(floor, Number(search.min)) : floor,
    search.max ? Math.min(ceil, Number(search.max)) : ceil,
  ]
  const [range, setRange] = useState(fromUrl)

  // Mantém o slider sincronizado com a URL (histórico/refresh) e com a chegada das facetas.
  const syncKey = `${search.min ?? ''}|${search.max ?? ''}|${floor}|${ceil}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setRange(fromUrl())
  }

  if (!facets) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  const [lo, hi] = range
  const span = ceil - floor || 1
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onChange({
      min: lo > floor ? lo.toFixed(2) : undefined,
      max: hi < ceil ? hi.toFixed(2) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Faixa de preço">
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden="true" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${((lo - floor) / span) * 100}%`, right: `${((ceil - hi) / span) * 100}%` }}
          aria-hidden="true"
        />
        <label htmlFor={`${idPrefix}-min`} className="sr-only">
          Preço mínimo (ETH)
        </label>
        <input
          id={`${idPrefix}-min`}
          type="range"
          className="range-dual"
          min={floor}
          max={ceil}
          step={0.01}
          value={lo}
          onChange={(e) => setRange([Math.min(Number(e.target.value), hi), hi])}
          aria-valuetext={`${lo.toFixed(2)} ETH`}
        />
        <label htmlFor={`${idPrefix}-max`} className="sr-only">
          Preço máximo (ETH)
        </label>
        <input
          id={`${idPrefix}-max`}
          type="range"
          className="range-dual"
          min={floor}
          max={ceil}
          step={0.01}
          value={hi}
          onChange={(e) => setRange([lo, Math.max(Number(e.target.value), lo)])}
          aria-valuetext={`${hi.toFixed(2)} ETH`}
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Preço: {lo.toFixed(2)} - {hi.toFixed(2)} ETH
      </p>
      <Button type="submit" size="xs" className="h-7 self-start rounded-sm px-3 text-xs">
        Aplicar
      </Button>
    </form>
  )
}

export function CatalogFilters({ search, onChange, idPrefix }: CatalogFiltersProps) {
  const { data: facets } = useFacets()
  const selected = new Set((search.cat?.split(',') ?? []) as CategoryId[])

  const toggleCategory = (id: CategoryId, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    onChange({ cat: next.size ? CATEGORIES.filter((c) => next.has(c.id)).map((c) => c.id).join(',') : undefined })
  }

  const hasFilters = !!(search.cat || search.col || search.min || search.max || search.status || search.q || search.tab)

  return (
    <div className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-2.5">
        <legend className={sectionTitle}>Coleções</legend>
        {CATEGORIES.map((c) => {
          const count = facets?.categories.find((f) => f.id === c.id)?.count
          const id = `${idPrefix}-cat-${c.id}`
          const checked = selected.has(c.id)
          return (
            <div key={c.id} className={row}>
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v) => toggleCategory(c.id, v === true)}
                className="size-3.5 rounded-[3px] [&_svg]:size-3"
              />
              <label
                htmlFor={id}
                className={cn('flex flex-1 cursor-pointer justify-between gap-2 hover:text-primary', checked && 'text-primary')}
              >
                <span>{c.label}</span>
                {count !== undefined && <span className="text-muted-foreground">({count})</span>}
              </label>
            </div>
          )
        })}
      </fieldset>

      <div className="flex flex-col">
        <h3 className={sectionTitle}>Faixa de preço</h3>
        <PriceRange search={search} onChange={onChange} idPrefix={idPrefix} />
      </div>

      <fieldset className="flex flex-col">
        <legend className={sectionTitle}>Disponibilidade</legend>
        <RadioGroup
          value={search.status ?? 'all'}
          onValueChange={(v) => onChange({ status: v === 'all' ? undefined : (v as AvailabilityFilter) })}
          className="gap-2.5"
        >
          {STATUS_OPTIONS.map((o) => {
            const active = (search.status ?? 'all') === o.value
            return (
              <div key={o.value} className={row}>
                <RadioGroupItem value={o.value} id={`${idPrefix}-status-${o.value}`} className="size-3.5" />
                <label
                  htmlFor={`${idPrefix}-status-${o.value}`}
                  className={cn('cursor-pointer hover:text-primary', active && 'text-primary')}
                >
                  {o.label}
                </label>
              </div>
            )
          })}
        </RadioGroup>
      </fieldset>

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-collection`} className={sectionTitle}>
          Série
        </label>
        <NativeSelect
          id={`${idPrefix}-collection`}
          className="h-9"
          selectClassName="text-xs"
          value={search.col ?? 'all'}
          onChange={(e) => onChange({ col: e.target.value === 'all' ? undefined : e.target.value })}
        >
          <option value="all">Todas as séries</option>
          {facets?.collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.count})
            </option>
          ))}
        </NativeSelect>
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="self-start text-xs"
          onClick={() =>
            onChange({
              q: undefined,
              cat: undefined,
              col: undefined,
              min: undefined,
              max: undefined,
              status: undefined,
              tab: undefined,
            })
          }
        >
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
