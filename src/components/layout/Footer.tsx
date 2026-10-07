import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORIES } from '@/contracts'
import { Logo } from './Logo'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades e listas de acesso a coleções do mercado.',
  },
]

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
)

const SOCIAL = [
  {
    label: 'Facebook',
    href: 'https://facebook.com',
    icon: svg(<path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z" />),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    icon: svg(
      <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM16.5 2h-9A5.5 5.5 0 0 0 2 7.5v9A5.5 5.5 0 0 0 7.5 22h9a5.5 5.5 0 0 0 5.5-5.5v-9A5.5 5.5 0 0 0 16.5 2Zm3.7 14.5a3.7 3.7 0 0 1-3.7 3.7h-9a3.7 3.7 0 0 1-3.7-3.7v-9a3.7 3.7 0 0 1 3.7-3.7h9a3.7 3.7 0 0 1 3.7 3.7v9Z" />,
    ),
  },
  {
    label: 'X',
    href: 'https://x.com',
    icon: svg(<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: svg(<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4V9.5Z" />),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    icon: svg(<path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z" />),
  },
]

const WALLETS = ['MetaMask', 'WalletConnect', 'Coinbase']

const columnTitle = 'mb-3 text-sm font-medium'
const linkClass = 'rounded-sm hover:text-primary'

function Soon({ children }: { children: string }) {
  return (
    <span className="cursor-not-allowed text-muted-foreground" title="Em breve">
      {children}
      <span className="sr-only"> (em breve)</span>
    </span>
  )
}

function Newsletter() {
  const [message, setMessage] = useState<string | null>(null)
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage('A newsletter não está disponível nesta demonstração. Nenhum e-mail foi cadastrado.')
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title" className="text-sm font-medium">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Seu e-mail
        </label>
        <Input
          id="newsletter-email"
          type="email"
          placeholder="digite seu e-mail..."
          className="h-9 rounded-r-none text-xs"
          aria-describedby={message ? 'newsletter-msg' : 'newsletter-hint'}
        />
        <Button type="submit" size="xs" className="h-9 rounded-l-none px-4">
          Enviar
        </Button>
      </div>
      <p id="newsletter-hint" className="text-xs text-muted-foreground">
        Receba lançamentos selecionados, novidades de criadores e alertas do mercado.
      </p>
      <p id="newsletter-msg" role="status" className="text-xs text-warning empty:hidden">
        {message}
      </p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mt-12 text-xs md:mt-16">
      <div className="container-page">
        <div className="grid gap-6 rounded-md bg-surface p-5 md:grid-cols-2 md:p-6 lg:grid-cols-[1fr_1fr_1fr_1.2fr] lg:gap-0 lg:divide-x lg:divide-border">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-2 lg:px-5 lg:first:pl-0">
              <span
                aria-hidden="true"
                className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                {f.letter}
              </span>
              <h2 className="text-sm font-medium">{f.title}</h2>
              <p className="leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
          <div className="lg:pl-5">
            <Newsletter />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-[#3a2416]">
        <div className="container-page grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          <Logo className="justify-self-start" />
          <p>Feito para colecionadores, criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-labelledby="footer-profile">
          <h2 id="footer-profile" className={columnTitle}>
            Meu perfil
          </h2>
          <ul className="flex flex-col gap-2">
            <li>
              <Link to="/conta/perfil" className={linkClass}>
                Meu perfil
              </Link>
            </li>
            <li>
              <Soon>Minha coleção</Soon>
            </li>
            <li>
              <Soon>Atividade</Soon>
            </li>
            <li>
              <Soon>Estúdio do criador</Soon>
            </li>
            <li>
              <Link to="/conta/favoritos" className={linkClass}>
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className={columnTitle}>Central de ajuda</h2>
          <ul className="flex flex-col gap-2">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map(
              (item) => (
                <li key={item}>
                  <Soon>{item}</Soon>
                </li>
              ),
            )}
          </ul>
        </div>
        <nav aria-labelledby="footer-collections">
          <h2 id="footer-collections" className={columnTitle}>
            Coleções
          </h2>
          <ul className="flex flex-col gap-2">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link to="/" search={{ cat: c.id }} hash="catalogo" className={linkClass}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className={columnTitle}>Redes sociais</h2>
            <ul className="flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-7 items-center justify-center rounded-sm border border-primary text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {s.icon}
                    <span className="sr-only">{s.label} (abre em nova aba)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={columnTitle}>Carteiras compatíveis</h2>
            <ul className="flex flex-wrap gap-2">
              {WALLETS.map((w) => (
                <li key={w} className="rounded-sm border border-input px-2 py-1 text-[10px] font-bold tracking-wide uppercase">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-5 text-center text-muted-foreground">
        © 2026 Kurio. Propriedade digital para todos.
      </div>
    </footer>
  )
}
