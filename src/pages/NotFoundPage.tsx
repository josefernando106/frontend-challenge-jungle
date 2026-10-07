import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <section className="container-page flex flex-col items-center gap-6 py-24 text-center">
      <p className="font-mono text-6xl font-bold text-brand" aria-hidden="true">
        404
      </p>
      <h1 className="text-3xl font-semibold md:text-[38px]">Página não encontrada</h1>
      <p className="max-w-md text-muted-foreground">O endereço acessado não existe ou foi movido.</p>
      <Button asChild size="sm">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
