import { useNavigate } from '@tanstack/react-router'
import { Heart, LogOut, User, Wallet } from 'lucide-react'
import type { User as SessionUser } from '@/contracts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/features/auth/session'

export default function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-accent"
          aria-label={`Menu da conta de ${user.name}`}
          data-testid="user-menu"
        >
          <img src={user.avatarUrl} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
          <span className="hidden max-w-32 truncate font-semibold lg:inline">{user.name.split(' ')[0]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/perfil' })}>
          <User aria-hidden="true" /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/carteiras' })}>
          <Wallet aria-hidden="true" /> Carteiras
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/favoritos' })}>
          <Heart aria-hidden="true" /> Favoritos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout()
            void navigate({ to: '/' })
          }}
        >
          <LogOut aria-hidden="true" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
