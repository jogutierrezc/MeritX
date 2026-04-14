import React from 'react';
import { Plus, ShieldCheck } from 'lucide-react';

import type { RoleConfig } from '../../types/config';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  roles: RoleConfig[];
  onChange: (roles: RoleConfig[]) => void;
  onAddRole: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const RolesModule = ({ roles, onChange, onAddRole }: Props) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-slate-800">Gestion de Roles</h2>
        <p className="font-medium text-slate-500">Define niveles de acceso y permisos de cada perfil.</p>
      </div>
      <button
        onClick={onAddRole}
        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
      >
        <Plus size={16} /> Nuevo rol
      </button>
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {roles.map((role, index) => (
        <div
          key={role.role}
          className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-md transition-all hover:shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white">
                <ShieldCheck size={24} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Clave del rol
                  </p>
                </div>
                <input
                  value={role.role}
                  onChange={(e) =>
                    onChange(
                      roles.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              role: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_]+/g, '_')
                                .replace(/^_+|_+$/g, ''),
                            }
                          : r,
                      ),
                    )
                  }
                  placeholder="ej: comite_curricular"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                />
                <input
                  value={role.label}
                  onChange={(e) =>
                    onChange(roles.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                />
                <input
                  value={role.portal}
                  onChange={(e) =>
                    onChange(roles.map((r, i) => (i === index ? { ...r, portal: e.target.value } : r)))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 outline-none focus:border-blue-500"
                />
                <textarea
                  value={role.description}
                  onChange={(e) =>
                    onChange(roles.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))
                  }
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-600">
              <input
                type="checkbox"
                checked={role.active}
                onChange={(e) =>
                  onChange(roles.map((r, i) => (i === index ? { ...r, active: e.target.checked } : r)))
                }
              />
              Activo
            </label>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default RolesModule;
