import { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import Logo from './Logo';
import { APP_NAME, APP_TAGLINE } from '../constants/branding';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-800 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={44} />
            <div>
              <h1 className="text-lg font-bold m-0 tracking-tight">{APP_NAME}</h1>
              <p className="text-[11px] text-slate-400 m-0 leading-snug max-w-[220px]">{APP_TAGLINE}</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm cursor-pointer transition-colors"
          >
            <LogIn size={16} />
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>

          <p className="text-center text-[11px] text-slate-400 m-0">
            Desarrollado por <strong className="text-slate-500">TANGOID SRL</strong>
          </p>
        </form>
      </div>
    </div>
  );
}
