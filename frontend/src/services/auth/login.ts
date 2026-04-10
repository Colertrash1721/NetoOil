import { apiClient } from '@/services/api/client';
import { LoginResponse } from '@/types/auth';

export const loginService = async (user: string, password: string) => {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    user,
    password,
  });

  return response.data;
};
