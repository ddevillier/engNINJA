
import { Outlet, Link } from 'react-router-dom'

export default function App(){
  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-wide">EngNinja Pro</Link>
          <nav className="text-sm space-x-4">
            <a href="https://github.com/" target="_blank" rel="noreferrer" className="hover:underline opacity-70">Docs</a>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
