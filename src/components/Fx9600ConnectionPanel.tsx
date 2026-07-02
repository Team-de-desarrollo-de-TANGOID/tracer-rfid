import { useEffect, useState } from 'react';

import { Loader2, Wifi, Zap } from 'lucide-react';

import { api } from '../api/client';



interface Props {

  canEdit?: boolean;

}



export default function Fx9600ConnectionPanel({ canEdit = true }: Props) {

  const [config, setConfig] = useState<Record<string, string>>({});

  const [ip, setIp] = useState('');

  const [appPort, setAppPort] = useState('8765');

  const [user, setUser] = useState('admin');

  const [password, setPassword] = useState('');

  const [probing, setProbing] = useState(false);

  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);



  const demoMode = config.demo_mode === 'true';



  const loadMeta = async () => {

    const c = await api.getConfig();

    setConfig(c);

    setIp(c.fx9600_ip ?? '169.254.240.149');

    setAppPort(c.fx9600_app_port ?? '8765');

    setUser(c.fx9600_user ?? 'admin');

    if (c.demo_mode !== 'true') {

      try {

        const st = await api.syncStatus();

        if (st.connected) {

          const n = st.appStatus?.count;

          const v = st.appStatus?.version;

          setApiStatus(

            `User App API OK${n != null ? ` · ${n} TID` : ''}${v != null ? ` · v${v}` : ''}`

          );

        } else {

          setApiStatus(`Sin respuesta: ${st.error ?? st.appError ?? 'desconocido'}`);

        }

      } catch (e) {

        setApiStatus(e instanceof Error ? e.message : 'No se pudo consultar la User App');

      }

    }

  };



  useEffect(() => {

    loadMeta();

  }, []);



  const saveConnection = async () => {

    if (!config.fx9600_password && !password.trim()) {

      setResult({

        ok: false,

        message:

          'Ingrese la contraseña admin del FX9600 (necesaria para iniciar inventario en el lector).',

      });

      return;

    }

    const r = await api.syncConfig({

      ip,

      appPort: Number(appPort) || 8765,

      user,

      password: password || undefined,

    });

    if (r.credentialsPush && !r.credentialsPush.ok) {

      setResult({

        ok: false,

        message: r.credentialsPush.error ?? 'No se pudieron enviar credenciales al lector',

      });

      await loadMeta();

      return;

    }

    setResult({ ok: true, message: 'Configuración guardada y credenciales enviadas al lector' });

    setPassword('');

    await loadMeta();

  };



  const handleProbe = async () => {

    setProbing(true);

    setResult(null);

    try {

      const r = await api.syncProbe({

        ip,

        appPort: Number(appPort) || 8765,

        user,

        password: password || undefined,

      });

      if (r.ok) {

        setResult({ ok: true, message: r.message ?? `User App API OK en ${r.ip}:${r.appPort ?? appPort}` });

        await loadMeta();

      } else {

        setResult({

          ok: false,

          message: r.message ?? r.error ?? 'La User App API no respondió',

        });

      }

    } catch (e) {

      setResult({

        ok: false,

        message: e instanceof Error ? e.message : 'Error al probar la User App API',

      });

    } finally {

      setProbing(false);

    }

  };



  if (demoMode) {

    return (

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-900">

        Modo demo activo — sin lector físico.

      </div>

    );

  }



  return (

    <div className="space-y-6 max-w-2xl">

      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">

        <div>

          <h2 className="text-base font-semibold text-slate-800 m-0">User App API</h2>

          <p className="text-sm text-slate-500 mt-1 m-0">

            IP y puerto de la API REST de la User App en el lector.

          </p>

          {apiStatus && (

            <p

              className={`text-xs flex items-center gap-1 mt-2 ${

                apiStatus.startsWith('User App') ? 'text-emerald-700' : 'text-red-600'

              }`}

            >

              <Wifi size={14} /> {apiStatus}

            </p>

          )}

        </div>



        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">

          <label className="flex flex-col gap-1">

            <span className="text-xs text-slate-500">IP del lector</span>

            <input

              className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs disabled:bg-slate-50"

              value={ip}

              onChange={(e) => setIp(e.target.value)}

              disabled={!canEdit}

            />

          </label>

          <label className="flex flex-col gap-1">

            <span className="text-xs text-slate-500">Puerto API User App</span>

            <input

              className="border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs disabled:bg-slate-50"

              value={appPort}

              onChange={(e) => setAppPort(e.target.value)}

              disabled={!canEdit}

            />

          </label>

        </div>



        <details className="text-sm" open={!config.fx9600_password}>

          <summary className="text-xs text-slate-500 cursor-pointer select-none">

            Admin FX9600 (requerido para inventario en el lector)

          </summary>

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 m-0">

            La User App usa estas credenciales para arrancar el inventario RFID tras cada sincronización.

            {!config.fx9600_password

              ? ' Debe ingresarlas y pulsar Guardar.'

              : ' Deje en blanco para mantener la guardada.'}

          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">

            <label className="flex flex-col gap-1">

              <span className="text-xs text-slate-500">Usuario admin</span>

              <input

                className="border border-slate-200 rounded-lg px-3 py-2 text-xs disabled:bg-slate-50"

                value={user}

                onChange={(e) => setUser(e.target.value)}

                disabled={!canEdit}

              />

            </label>

            <label className="flex flex-col gap-1">

              <span className="text-xs text-slate-500">Contraseña admin</span>

              <input

                type="password"

                className="border border-slate-200 rounded-lg px-3 py-2 text-xs disabled:bg-slate-50"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                placeholder={config.fx9600_password ? '•••••••• (dejar vacío = mantener)' : 'Contraseña admin FX9600'}

                disabled={!canEdit}

              />

            </label>

          </div>

        </details>



        {canEdit && (

          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              disabled={probing || !ip.trim()}

              onClick={handleProbe}

              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-60"

            >

              {probing ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}

              Probar User App API

            </button>

            <button

              type="button"

              disabled={!ip.trim()}

              onClick={saveConnection}

              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"

            >

              Guardar

            </button>

          </div>

        )}



        {result && (

          <div

            className={`p-3 rounded-lg text-sm ${

              result.ok

                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'

                : 'bg-amber-50 text-amber-900 border border-amber-200'

            }`}

          >

            {result.message}

          </div>

        )}

      </div>



      <p className="text-xs text-slate-400 flex items-center gap-1">

        <Zap size={12} />

        Instale la User App desde <code className="font-mono">hardware/fx9600/</code> en el lector.

      </p>

    </div>

  );

}

