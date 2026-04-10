'use client';

import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/services/api/client';
import { UserApi, getUsersService, updateUserStatusService } from '@/services/users';

const FILTERS = [
  { label: 'Accepted', value: 'accepted' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
] as const;

const dateFormatter = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' });

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

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      if (user.status !== filter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [user.companyName, user.username, user.email]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [filter, searchTerm, users]);

  const acceptedCount = users.filter((user) => user.status === 'accepted').length;
  const pendingCount = users.filter((user) => user.status === 'pending').length;
  const rejectedCount = users.filter((user) => user.status === 'rejected').length;

  return (
    <div className="flex flex-col gap-4 h-full font-quicksand">
      <div className="flex flex-row h-[25%] justify-center gap-4 w-full">
        <Card className="bg-white h-full w-full p-6 rounded-lg shadow-md flex justify-center items-center flex-col border-0">
          <h1 className="text-xl font-bold mb-2">Usuarios activos</h1>
          <div className="flex flex-row gap-2 items-center">
            <i className="bx bx-user text-4xl" />
            <p className="text-2xl font-bold">{acceptedCount}</p>
          </div>
        </Card>
        <Card className="bg-white h-full w-full p-6 rounded-lg shadow-md flex justify-center items-center flex-col border-0">
          <h1 className="text-xl font-bold mb-2">Usuarios pendientes</h1>
          <div className="flex flex-row gap-2 items-center">
            <i className="bx bx-time-five text-4xl" />
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
        </Card>
        <Card className="bg-white h-full w-full p-6 rounded-lg shadow-md flex justify-center items-center flex-col border-0">
          <h1 className="text-xl font-bold mb-2">Usuarios rechazados</h1>
          <div className="flex flex-row gap-2 items-center">
            <i className="bx bx-x-circle text-4xl" />
            <p className="text-2xl font-bold">{rejectedCount}</p>
          </div>
        </Card>
      </div>

      <div className="bg-white h-[75%] p-6 rounded-lg shadow-md overflow-hidden flex flex-col">
        <div className="flex w-full h-fit justify-between mb-4 gap-4">
          <div className="flex gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`px-4 py-2 rounded transition-all ${
                  filter === item.value
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative flex p-2 w-1/3 h-fit bg-gray-900 rounded text-white justify-center items-center">
            <input
              type="text"
              placeholder="Buscar usuario o empresa"
              className="w-full h-full outline-hidden focus:outline-none placeholder-white tracking-widest bg-transparent"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <i className="bx bx-search absolute text-white right-5" />
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Cargando usuarios...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            No hay usuarios para este filtro.
          </div>
        ) : (
          <div className="flex-1 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-full table-auto border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Compañía</th>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Usuario</th>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Email</th>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Creado</th>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Estado</th>
                  <th className="px-4 py-2 text-left font-semibold sticky top-0">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 border-b border-gray-200">
                    <td className="px-4 py-3 whitespace-nowrap">{user.companyName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{user.username}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dateFormatter.format(new Date(user.creationDate))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap capitalize">{user.status}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={updatingId === user.id || user.status === 'accepted'}
                          onClick={() => handleStatusChange(user.id, 'accepted')}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === user.id || user.status === 'rejected'}
                          onClick={() => handleStatusChange(user.id, 'rejected')}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:bg-gray-300"
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
      </div>
    </div>
  );
}
