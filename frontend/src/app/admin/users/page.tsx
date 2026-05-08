'use client';

import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@/services/api/client';
import {
  UserApi,
  getUsersService,
  updateUserCompanyRoleService,
  updateUserStatusService,
} from '@/services/users';

const FILTERS = [
  { label: 'Aceptados', value: 'accepted', icon: 'bx-check-circle' },
  { label: 'Pendientes', value: 'pending', icon: 'bx-time-five' },
  { label: 'Rechazados', value: 'rejected', icon: 'bx-x-circle' },
] as const;

const dateFormatter = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' });

function StatCard({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-2xl ${tone}`}>
          <i className={`bx ${icon}`} />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </article>
  );
}

function statusLabel(status: UserApi['status']) {
  if (status === 'accepted') return 'Aceptado';
  if (status === 'pending') return 'Pendiente';
  return 'Rechazado';
}

function statusClass(status: UserApi['status']) {
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-rose-200';
}

function companyRoleLabel(role: UserApi['companyRole']) {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin empresa';
  return 'Usuario';
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserApi[]>([]);
  const [filter, setFilter] = useState<UserApi['status']>('accepted');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await getUsersService();
      setUsers(data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar los usuarios.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleStatusChange(userId: number, status: UserApi['status']) {
    setUpdatingId(userId);
    setErrorMessage(null);

    try {
      await updateUserStatusService(userId, status);
      await loadUsers();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo actualizar el estado.'));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRoleChange(userId: number, companyRole: UserApi['companyRole']) {
    setUpdatingId(userId);
    setErrorMessage(null);

    try {
      await updateUserCompanyRoleService(userId, companyRole);
      await loadUsers();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo actualizar el rol.'));
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      if (user.status !== filter) return false;
      if (!normalizedSearch) return true;

      return [user.companyName, user.username, user.email]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [filter, searchTerm, users]);

  const acceptedCount = users.filter((user) => user.status === 'accepted').length;
  const pendingCount = users.filter((user) => user.status === 'pending').length;
  const rejectedCount = users.filter((user) => user.status === 'rejected').length;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/75">Usuarios</p>
            <h1 className="mt-2 text-3xl font-semibold">Solicitudes y accesos</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Revisa usuarios por estado, filtra por empresa o correo y aprueba accesos desde una tabla estable.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
          >
            <i className="bx bx-refresh text-lg" />
            Actualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Activos" value={acceptedCount} detail="Usuarios con acceso concedido" icon="bx-user-check" tone="bg-emerald-50 text-emerald-700" />
        <StatCard title="Pendientes" value={pendingCount} detail="Solicitudes esperando revisión" icon="bx-time-five" tone="bg-amber-50 text-amber-700" />
        <StatCard title="Rechazados" value={rejectedCount} detail="Accesos denegados o descartados" icon="bx-user-x" tone="bg-rose-50 text-rose-700" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  ].join(' ')}
                >
                  <i className={`bx ${item.icon} text-lg`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full xl:max-w-md">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
            <input
              type="text"
              placeholder="Buscar usuario, empresa o email"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-slate-500">
            Cargando usuarios...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center text-slate-500">
            No hay usuarios para este filtro.
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Compañía</th>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Creado</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Rol empresa</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="text-slate-700 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-950">{user.companyName}</td>
                    <td className="px-4 py-3">{user.username}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{dateFormatter.format(new Date(user.creationDate))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(user.status)}`}>
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.companyRole}
                        disabled={updatingId === user.id}
                        onChange={(event) => void handleRoleChange(user.id, event.target.value as UserApi['companyRole'])}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-400 disabled:bg-slate-100"
                      >
                        <option value="user">{companyRoleLabel('user')}</option>
                        <option value="admin">{companyRoleLabel('admin')}</option>
                        <option value="superadmin">{companyRoleLabel('superadmin')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingId === user.id || user.status === 'accepted'}
                          onClick={() => handleStatusChange(user.id, 'accepted')}
                          className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === user.id || user.status === 'rejected'}
                          onClick={() => handleStatusChange(user.id, 'rejected')}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
