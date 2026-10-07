import type { RealtimeEvent } from '@/contracts'

/**
 * Filtro de eventos: descarta duplicatas (mesmo eventId) e eventos antigos
 * (versão ≤ última versão aplicada para o mesmo recurso). Uma instância por sessão de socket.
 */
export class EventGate {
  private seen = new Set<string>()
  private order: string[] = []
  private versions = new Map<string, number>()

  constructor(private readonly capacity = 500) {}

  accept(event: RealtimeEvent): boolean {
    if (this.seen.has(event.eventId)) return false
    this.remember(event.eventId)
    const key = `${event.resource.type}:${event.resource.id}`
    const last = this.versions.get(key) ?? 0
    if (event.version <= last) return false
    this.versions.set(key, event.version)
    return true
  }

  /** Registra uma versão observada via REST (evita aplicar evento mais antigo que o cache). */
  observe(resourceType: string, id: string, version: number) {
    const key = `${resourceType}:${id}`
    if ((this.versions.get(key) ?? 0) < version) this.versions.set(key, version)
  }

  private remember(id: string) {
    this.seen.add(id)
    this.order.push(id)
    if (this.order.length > this.capacity) this.seen.delete(this.order.shift()!)
  }
}
