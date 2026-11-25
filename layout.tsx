import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Acervo | Gestão de biblioteca', description: 'Painel de gestão de acervo, leitores e empréstimos' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
