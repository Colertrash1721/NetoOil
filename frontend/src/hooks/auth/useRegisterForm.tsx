import React from 'react';
import { useEffect, useState } from 'react';
import { RegisterState } from '@/types/auth';
import { useRouter } from 'next/navigation';
import { registerService } from '@/services/auth/register';
import { getApiErrorMessage } from '@/services/api/client';
import { CompanyApi, getCompaniesService } from '@/services/companies/service';

export default function useRegisterForm() {
  const router = useRouter();
  const [successMessage, setsuccessMessage] = useState('');
  const [errorMessage, seterrorMessage] = useState('');
  const [companies, setCompanies] = useState<CompanyApi[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [handleInputs, sethandleInputs] = useState<RegisterState>({
    username: '',
    password: '',
    email: '',
    companyId: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    sethandleInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    seterrorMessage('');

    try {
      const { username, password, email, companyId } = handleInputs;
      await registerService(username, password, email, Number(companyId));
      setsuccessMessage('Registro enviado con exito. Espera aprobacion.');

      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error: unknown) {
      seterrorMessage(getApiErrorMessage(error, 'No se pudo completar el registro.'));
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const data = await getCompaniesService();
        setCompanies(data);
      } catch (error) {
        seterrorMessage(getApiErrorMessage(error, 'No se pudieron cargar las empresas.'));
      } finally {
        setLoadingCompanies(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => seterrorMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setsuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return {
    companies,
    loadingCompanies,
    handleInputs,
    handleChange,
    handleSubmit,
    successMessage,
    errorMessage,
  };
}
