import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import type { Faculty, UserProfile } from '../../module_bindings/types';
import type { NewUserForm, RoleConfig } from '../../types/config';

// ─── Constants ────────────────────────────────────────────────────────────────

const NEW_USER_EMPTY: NewUserForm = {
  nombre: '',
  correo: '',
  campus: 'VALLEDUPAR',
  password: '',
  role: 'decano',
  facultyId: undefined,
};

const isDecanoLikeRole = (role: string) => role.trim().toLowerCase().includes('decano');

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  users: UserProfile[];
  roles: RoleConfig[];
  faculties: Faculty[];
  assignments: Record<string, { facultyId: string; facultyName: string; active: boolean }>;
  saving: boolean;
  onAddUser: (form: NewUserForm) => Promise<void>;
  onUpdateUser: (form: {
    correo: string;
    nombre: string;
    campus: string;
    role: string;
    active: boolean;
    facultyId?: string;
  }) => Promise<void>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const UsuariosModule = ({ users, roles, faculties, assignments, saving, onAddUser, onUpdateUser }: Props) => {
  const [newUser, setNewUser] = useState<NewUserForm>(NEW_USER_EMPTY);
  const [searchTerm, setSearchTerm] = useState('');
  const [edits, setEdits] = useState<
    Record<string, { nombre: string; campus: string; role: string; active: boolean; facultyId?: string }>
  >({});

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q) ||
        u.campus.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [searchTerm, users]);

  const handleAdd = async () => {
    await onAddUser(newUser);
    setNewUser(NEW_USER_EMPTY);
  };

  const getEdit = (user: UserProfile) => {
    const key = user.correo.toLowerCase();
    const existing = edits[key];
    if (existing) return existing;
    return {
      nombre: user.nombre,
      campus: user.campus,
      role: user.role,
      active: user.active,
      facultyId: assignments[key]?.facultyId,
    };
  };

  const updateEdit = (
    correo: string,
    patch: Partial<{ nombre: string; campus: string; role: string; active: boolean; facultyId?: string }>,
  ) => {
    const key = correo.toLowerCase();
    setEdits((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {
          nombre: '',
          campus: 'VALLEDUPAR',
          role: 'decano',
          active: true,
          facultyId: undefined,
        }),
        ...patch,
      },
    }));
  };

  const handleSaveUser = async (user: UserProfile) => {
    const edit = getEdit(user);
    await onUpdateUser({
      correo: user.correo,
      nombre: edit.nombre,
      campus: edit.campus,
      role: edit.role,
      active: edit.active,
      facultyId: edit.facultyId,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-slate-800">Usuarios del Sistema</h2>
        <p className="font-medium text-slate-500">Administra los accesos y permisos de los colaboradores.</p>
      </div>

      {/* ── Create user form ── */}
      <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
        <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-700">
          <div className="h-6 w-2 rounded-full bg-blue-600" /> Crear Nuevo Usuario
        </h3>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Nombre Completo
            </label>
            <input
              value={newUser.nombre}
              onChange={(e) => setNewUser((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej. Juan Perez"
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Correo Electronico
            </label>
            <input
              value={newUser.correo}
              onChange={(e) => setNewUser((p) => ({ ...p, correo: e.target.value }))}
              placeholder="usuario@udes.edu.co"
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Campus</label>
            <select
              value={newUser.campus}
              onChange={(e) => setNewUser((p) => ({ ...p, campus: e.target.value }))}
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            >
              <option>VALLEDUPAR</option>
              <option>BUCARAMANGA</option>
              <option>CUCUTA</option>
              <option>BOGOTA</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Rol</label>
            <select
              value={newUser.role}
              onChange={(e) =>
                setNewUser((p) => ({
                  ...p,
                  role: e.target.value,
                  facultyId:
                    isDecanoLikeRole(e.target.value) ? p.facultyId : undefined,
                }))
              }
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            >
              {roles
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
            </select>
          </div>

            {isDecanoLikeRole(String(newUser.role)) && (
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Facultad asignada (obligatoria para Decano)
                </label>
                <select
                  value={newUser.facultyId || ''}
                  onChange={(e) => setNewUser((p) => ({ ...p, facultyId: e.target.value || undefined }))}
                  className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
                >
                  <option value="">Selecciona facultad</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.facultyId} value={faculty.facultyId}>
                      {faculty.facultyName}
                    </option>
                  ))}
                </select>
              </div>
            )}

          <div className="space-y-2 md:col-span-2">
            <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
              Contraseña
            </label>
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
              placeholder="********"
              className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-blue-700 disabled:opacity-60 md:col-span-2"
          >
            <Plus size={20} /> Agregar Usuario al Sistema
          </button>
        </div>
      </div>

      {/* ── Users list ── */}
      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40">
        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Usuarios Registrados
          </h3>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-4 text-xs font-semibold outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="space-y-3">
          {filteredUsers.length === 0 && (
            <p className="text-sm font-semibold text-slate-400">No hay usuarios para mostrar.</p>
          )}
          {filteredUsers.map((user) => (
            <div
              key={`${user.correo}-${user.id}`}
              className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{user.nombre}</p>
                  <p className="text-xs font-medium text-slate-500">{user.correo}</p>
                </div>
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${getEdit(user).active ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>
                  <div className={`h-2 w-2 rounded-full ${getEdit(user).active ? 'bg-green-500' : 'bg-rose-500'}`} />
                  {getEdit(user).active ? 'ACTIVO' : 'INACTIVO'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input
                  value={getEdit(user).nombre}
                  onChange={(e) => updateEdit(user.correo, { nombre: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-400"
                />
                <select
                  value={getEdit(user).campus}
                  onChange={(e) => updateEdit(user.correo, { campus: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-400"
                >
                  <option>VALLEDUPAR</option>
                  <option>BUCARAMANGA</option>
                  <option>CUCUTA</option>
                  <option>BOGOTA</option>
                </select>
                <select
                  value={getEdit(user).role}
                  onChange={(e) =>
                    updateEdit(user.correo, {
                      role: e.target.value,
                      facultyId:
                        isDecanoLikeRole(e.target.value)
                          ? getEdit(user).facultyId
                          : undefined,
                    })
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-400"
                >
                  {roles.filter((role) => role.active).map((role) => (
                    <option key={role.role} value={role.role}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => updateEdit(user.correo, { active: !getEdit(user).active })}
                  className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${getEdit(user).active ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                >
                  {getEdit(user).active ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {isDecanoLikeRole(getEdit(user).role) && (
                <select
                  value={getEdit(user).facultyId || ''}
                  onChange={(e) => updateEdit(user.correo, { facultyId: e.target.value || undefined })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-400"
                >
                  <option value="">Selecciona facultad para Decano</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.facultyId} value={faculty.facultyId}>
                      {faculty.facultyName}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => void handleSaveUser(user)}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UsuariosModule;
