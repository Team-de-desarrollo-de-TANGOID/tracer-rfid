import { useCallback, useEffect, useState } from 'react';
import { Trash2, Shield, UserPlus, Save, KeyRound } from 'lucide-react';
import { api } from '../api/client';
import CollapsibleAddForm from './CollapsibleAddForm';
import type { Permiso, Rol, UsuarioListItem } from '../types';
interface Props {
  canManageUsers: boolean;
  canManageRoles: boolean;
  canViewUsers: boolean;
  embedded?: boolean;
}

export default function UsersRolesView({
  canManageUsers,
  canManageRoles,
  canViewUsers,
  embedded = false,
}: Props) {
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingRol, setEditingRol] = useState<Rol | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', nombre: '', rolId: 0 });
  const [newRol, setNewRol] = useState({ nombre: '', descripcion: '', permisos: [] as string[] });
  const [passwordEditId, setPasswordEditId] = useState<number | null>(null);
  const [passwordEditValue, setPasswordEditValue] = useState('');

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  };

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      canManageRoles || canViewUsers ? api.getRoles() : Promise.resolve([]),
      canManageRoles ? api.getPermisos() : Promise.resolve([]),
    ]);
    setRoles(r);
    setPermisos(p);
    if (canViewUsers || canManageUsers) {
      setUsuarios(await api.getUsuarios());
    }
    if (r.length && !newUser.rolId) setNewUser((u) => ({ ...u, rolId: r[0].id }));
  }, [canManageRoles, canViewUsers, canManageUsers, newUser.rolId]);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = async (close: () => void) => {
    if (!newUser.username || !newUser.password) return;
    try {
      await api.createUsuario(newUser);
      setNewUser({ username: '', password: '', nombre: '', rolId: roles[0]?.id ?? 0 });
      flash('Usuario creado');
      load();
      close();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error');
    }
  };

  const savePassword = async (userId: number) => {
    if (!passwordEditValue.trim()) {
      flash('Ingrese la nueva contraseña');
      return;
    }
    try {
      await api.updateUsuario(userId, { password: passwordEditValue });
      setPasswordEditId(null);
      setPasswordEditValue('');
      flash('Contraseña actualizada');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error');
    }
  };

  const createRol = async (close: () => void) => {
    if (!newRol.nombre.trim()) return;
    try {
      await api.createRol(newRol);
      setNewRol({ nombre: '', descripcion: '', permisos: [] });
      flash('Rol creado');
      load();
      close();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error');
    }
  };
  const saveRol = async () => {
    if (!editingRol) return;
    try {
      await api.updateRol(editingRol.id, {
        nombre: editingRol.nombre,
        descripcion: editingRol.descripcion,
        permisos: editingRol.permisos,
      });
      setEditingRol(null);
      flash('Rol actualizado');
      load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Error');
    }
  };

  const permisosPorModulo = permisos.reduce<Record<string, Permiso[]>>((acc, p) => {
    (acc[p.modulo] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className={`flex flex-col h-full overflow-hidden ${embedded ? '' : 'bg-[#f8fafc]'}`}>
      {!embedded && (
        <header className="px-8 py-6 bg-white border-b border-[#e2e8f0]">
          <h1 className="text-2xl font-bold text-[#0f172a] m-0">Usuarios y roles</h1>
          <p className="text-[13px] text-[#64748b] mt-1 m-0">
            Gestione quién accede al sistema y qué puede hacer cada rol.
          </p>
        </header>
      )}

      {msg && (
        <div
          className={`px-4 py-2 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-200 ${
            embedded ? 'mx-8 mt-4 shrink-0' : 'mx-8 mt-4'
          }`}
        >
          {msg}
        </div>
      )}

      <div className={`flex gap-2 shrink-0 ${embedded ? 'px-8 pt-6' : 'px-8 pt-4'}`}>
        {(canViewUsers || canManageUsers) && (
          <TabBtn active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>
            <UserPlus size={14} /> Usuarios
          </TabBtn>
        )}
        {canManageRoles && (
          <TabBtn active={tab === 'roles'} onClick={() => setTab('roles')}>
            <Shield size={14} /> Roles y permisos
          </TabBtn>
        )}
      </div>

      <div className="p-8 overflow-y-auto flex-1">
        {tab === 'usuarios' && (canViewUsers || canManageUsers) && (
          <div className="space-y-6">
            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 m-0">Usuarios del sistema</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="pb-2">Usuario</th>
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Rol</th>
                    <th className="pb-2">Estado</th>
                    {canManageUsers && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 font-mono font-semibold">
                        {u.username}
                        {u.esSistema && (
                          <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded normal-case tracking-normal font-sans">
                            Sistema
                          </span>
                        )}
                      </td>
                      <td className="py-2">{u.nombre}</td>
                      <td className="py-2">{u.rolNombre}</td>
                      <td className="py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canManageUsers && (
                        <td className="py-2 text-right">
                          <div className="inline-flex flex-col items-end gap-1.5">
                            {passwordEditId === u.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="password"
                                  value={passwordEditValue}
                                  onChange={(e) => setPasswordEditValue(e.target.value)}
                                  placeholder="Nueva contraseña"
                                  className="py-1 px-2 border border-slate-200 rounded text-xs w-36 bg-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void savePassword(u.id);
                                    if (e.key === 'Escape') {
                                      setPasswordEditId(null);
                                      setPasswordEditValue('');
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => void savePassword(u.id)}
                                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPasswordEditId(null);
                                    setPasswordEditValue('');
                                  }}
                                  className="text-xs text-slate-500 hover:underline cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  title="Cambiar contraseña"
                                  onClick={() => {
                                    setPasswordEditId(u.id);
                                    setPasswordEditValue('');
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline cursor-pointer"
                                >
                                  <KeyRound size={12} />
                                  Contraseña
                                </button>
                                {!u.esSistema && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await api.updateUsuario(u.id, { activo: !u.activo });
                                          load();
                                        } catch (e) {
                                          flash(e instanceof Error ? e.message : 'Error');
                                        }
                                      }}
                                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                                    >
                                      {u.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
                                        try {
                                          await api.deleteUsuario(u.id);
                                          load();
                                        } catch (e) {
                                          flash(e instanceof Error ? e.message : 'Error');
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {canManageUsers && (
              <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
                <CollapsibleAddForm label="Agregar">
                  {(close) => (
                    <>
                      <h2 className="font-bold text-slate-800 m-0 text-sm">Nuevo usuario</h2>
                      <div className="grid md:grid-cols-2 gap-3">
                        <input
                          placeholder="Usuario"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          className="py-2 px-3 border rounded-lg text-sm bg-white"
                        />
                        <input
                          placeholder="Nombre completo"
                          value={newUser.nombre}
                          onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                          className="py-2 px-3 border rounded-lg text-sm bg-white"
                        />
                        <input
                          type="password"
                          placeholder="Contraseña"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="py-2 px-3 border rounded-lg text-sm bg-white"
                        />
                        <select
                          value={newUser.rolId}
                          onChange={(e) => setNewUser({ ...newUser, rolId: Number(e.target.value) })}
                          className="py-2 px-3 border rounded-lg text-sm bg-white"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => createUser(close)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Guardar usuario
                      </button>
                    </>
                  )}
                </CollapsibleAddForm>
              </section>
            )}
          </div>
        )}

        {tab === 'roles' && canManageRoles && (
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 m-0">Roles</h2>
              <ul className="space-y-2 mb-6">
                {roles.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                      editingRol?.id === r.id ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                    onClick={() => setEditingRol({ ...r })}
                  >
                    <div>
                      <span className="font-semibold text-sm">{r.nombre}</span>
                      {r.esSistema && (
                        <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                          Sistema
                        </span>
                      )}
                      <p className="text-xs text-slate-500 m-0 mt-0.5">
                        {r.permisos.length} permisos · {r.usuariosCount} usuario(s)
                      </p>
                    </div>
                    {!r.esSistema && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`¿Eliminar rol ${r.nombre}?`)) return;
                          try {
                            await api.deleteRol(r.id);
                            if (editingRol?.id === r.id) setEditingRol(null);
                            load();
                          } catch (err) {
                            flash(err instanceof Error ? err.message : 'Error');
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <CollapsibleAddForm label="Agregar">
                {(close) => (
                  <>
                    <h3 className="text-sm font-semibold text-slate-700 m-0">Nuevo rol</h3>
                    <input
                      placeholder="Nombre del rol"
                      value={newRol.nombre}
                      onChange={(e) => setNewRol({ ...newRol, nombre: e.target.value })}
                      className="w-full py-2 px-3 border rounded-lg text-sm bg-white"
                    />
                    <input
                      placeholder="Descripción"
                      value={newRol.descripcion}
                      onChange={(e) => setNewRol({ ...newRol, descripcion: e.target.value })}
                      className="w-full py-2 px-3 border rounded-lg text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => createRol(close)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer"
                    >
                      Guardar rol
                    </button>
                  </>
                )}
              </CollapsibleAddForm>
            </section>

            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 m-0">
                {editingRol ? `Permisos: ${editingRol.nombre}` : 'Seleccione un rol'}
              </h2>
              {editingRol && (
                <>
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-4">
                    {Object.entries(permisosPorModulo).map(([modulo, perms]) => (
                      <div key={modulo}>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">{modulo}</p>
                        <div className="space-y-1">
                          {perms.map((p) => (
                            <label
                              key={p.codigo}
                              className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={editingRol.permisos.includes(p.codigo)}
                                onChange={() => {
                                  setEditingRol((r) => {
                                    if (!r) return r;
                                    const has = r.permisos.includes(p.codigo);
                                    return {
                                      ...r,
                                      permisos: has
                                        ? r.permisos.filter((c) => c !== p.codigo)
                                        : [...r.permisos, p.codigo],
                                    };
                                  });
                                }}
                              />
                              <span>{p.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-auto">
                                {p.codigo}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={saveRol}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <Save size={14} /> Guardar permisos
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
        active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
