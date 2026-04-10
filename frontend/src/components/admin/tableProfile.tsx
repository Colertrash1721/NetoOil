'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';
import { getApiErrorMessage } from '@/services/api/client';
import {
  CompanyApi,
  CompanyCreatePayload,
  createCompanyService,
  getCompaniesService,
} from '@/services/companies/service';

type CompanyFormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  rnc: string;
};

const initialFormState: CompanyFormState = {
  name: '',
  address: '',
  phone: '',
  email: '',
  rnc: '',
};

const dateFormatter = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'medium',
});

export default function ProfileTable() {
  const [companies, setCompanies] = useState<CompanyApi[]>([]);
  const [form, setForm] = useState<CompanyFormState>(initialFormState);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadCompanies() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await getCompaniesService();
      setCompanies(data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar las empresas.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: CompanyCreatePayload = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        rnc: form.rnc.trim(),
      };

      if (!payload.name || !payload.address || !payload.email || !payload.rnc) {
        throw new Error('Nombre, direccion, email y RNC son obligatorios.');
      }

      await createCompanyService(payload);
      setForm(initialFormState);
      setSuccessMessage('Empresa creada correctamente.');
      await loadCompanies();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear la empresa.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full font-quicksand">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white h-full w-full p-6 rounded-lg shadow-md border-0">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-widest text-blue-500">
                ADMINISTRACION
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">
                Crear empresa
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Registra nuevas empresas desde la pantalla de administradores.
              </p>
            </div>
            <div className="bg-gray-100 h-fit w-fit px-4 py-3 rounded-lg shadow-sm flex justify-center items-center flex-col">
              <p className="text-xs tracking-widest text-gray-600">EMPRESAS</p>
              <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Nombre
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Neto Oil Logistics"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Direccion
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Santo Domingo, Republica Dominicana"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Telefono
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="809-555-0101"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                RNC
                <input
                  name="rnc"
                  value={form.rnc}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="101234567"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                placeholder="operaciones@empresa.com"
              />
            </label>

            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {creating ? 'Creando empresa...' : 'Crear empresa'}
            </button>
          </form>
        </Card>

        <Card className="bg-white h-full w-full p-6 rounded-lg shadow-md border-0">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-widest text-blue-500">
                DIRECTORIO
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">
                Empresas registradas
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Vista rapida de las empresas disponibles para asignar flota.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Cargando empresas...
            </div>
          ) : companies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              No hay empresas registradas.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[1.3fr_1fr_0.9fr_0.8fr] gap-4 bg-gray-100 px-5 py-4 text-xs font-semibold tracking-widest text-gray-600">
                <span>Empresa</span>
                <span>Contacto</span>
                <span>RNC</span>
                <span>Creada</span>
              </div>
              <div className="divide-y divide-gray-200">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="grid grid-cols-[1.3fr_1fr_0.9fr_0.8fr] gap-4 px-5 py-4 text-sm text-gray-700"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{company.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{company.address}</p>
                    </div>
                    <div>
                      <p>{company.email}</p>
                      <p className="mt-1 text-xs text-gray-500">{company.phone || 'Sin telefono'}</p>
                    </div>
                    <div className="font-medium text-gray-800">{company.rnc}</div>
                    <div className="text-gray-500">
                      {company.creationDate
                        ? dateFormatter.format(new Date(company.creationDate))
                        : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
