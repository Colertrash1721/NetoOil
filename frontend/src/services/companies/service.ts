import { apiClient } from '@/services/api/client';

export type CompanyApi = {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  rnc: string;
  creationDate: string;
};

export type CompanyCreatePayload = {
  name: string;
  address: string;
  phone: string;
  email: string;
  rnc: string;
};

export const getCompaniesService = async () => {
  const response = await apiClient.get<CompanyApi[]>('/companies/');
  return response.data;
};

export const createCompanyService = async (payload: CompanyCreatePayload) => {
  const response = await apiClient.post<CompanyApi>('/companies/', payload);
  return response.data;
};
