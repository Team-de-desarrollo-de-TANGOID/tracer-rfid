import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, User } from 'lucide-react';
import { APP_NAME, APP_TAGLINE, APP_VERSION, COMPANY } from '../constants/branding';
import { APP_PATHS } from '../routes/appRoutes';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function LoginView({ onLogin }: Props) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('Administrador');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isElectron = Boolean(
    (window as unknown as { racketClub?: { isElectron?: boolean } }).racketClub?.isElectron
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(username, password);
      navigate(APP_PATHS.dashboard, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full py-3 pl-11 pr-4 rounded-xl border border-slate-200/90 bg-white text-sm font-form text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-[box-shadow,border-color]';

  return (
    <div
      className={`relative ${
        isElectron ? 'min-h-full' : 'min-h-screen'
      } overflow-hidden flex items-center justify-center px-4 py-8`}
    >
      {/* Atmosphere */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(155deg, #e8eef7 0%, #f1f5f9 38%, #e6f4f1 72%, #eef2ff 100%)',
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.12) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-blue-400/20 blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 w-[380px] h-[380px] rounded-full bg-teal-400/15 blur-3xl -z-10" />

      {/* Soft RFID rings */}
      <svg
        className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 w-[min(640px,90vw)] h-auto opacity-[0.12] -z-10"
        viewBox="0 0 400 400"
        aria-hidden
      >
        <circle cx="200" cy="200" r="70" fill="none" stroke="#1e40af" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="110" fill="none" stroke="#0d9488" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="#1e40af" strokeWidth="1" />
        <circle cx="200" cy="200" r="190" fill="none" stroke="#64748b" strokeWidth="0.8" />
      </svg>

      <div className="w-full max-w-[420px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center gap-4 mb-7 text-left"
        >
          <motion.img
            src={`${import.meta.env.BASE_URL}tangoid.png`}
            alt={COMPANY.brand}
            width={72}
            height={72}
            draggable={false}
            className="object-contain drop-shadow-sm shrink-0"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="min-w-0">
            <h1 className="m-0 text-[1.75rem] font-bold tracking-tight text-slate-900 font-form leading-none">
              {APP_NAME}
            </h1>
            <p className="m-0 mt-1.5 text-sm text-slate-500 max-w-[240px] leading-snug">{APP_TAGLINE}</p>
          </div>
        </motion.div>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/85 backdrop-blur-md border border-white/80 rounded-2xl shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] px-7 py-7 space-y-5"
        >
          <div className="text-center mb-1">
            <h2 className="m-0 text-base font-semibold text-slate-800 font-form">Iniciar sesión</h2>
            <p className="m-0 mt-1 text-xs text-slate-500">Ingresá tus credenciales para continuar</p>
          </div>

          <div>
            <label htmlFor="login-user" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                id="login-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={fieldClass}
                autoComplete="username"
                placeholder="Tu usuario"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-pass" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} pr-11`}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-0 bg-transparent cursor-pointer"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="m-0 leading-snug">{error}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm font-form cursor-pointer border-0 shadow-sm shadow-blue-600/25 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Ingresando…
              </>
            ) : (
              <>
                <LogIn size={17} />
                Iniciar sesión
              </>
            )}
          </button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-center text-[11px] text-slate-500 m-0 mt-6 leading-relaxed"
        >
          Desarrollado por <span className="font-semibold text-slate-700">{COMPANY.legalName}</span>
          <span className="text-slate-300 mx-1.5">·</span>
          <span className="font-mono text-slate-400">v{APP_VERSION}</span>
        </motion.p>
      </div>
    </div>
  );
}
