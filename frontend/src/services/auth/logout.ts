import { apiClient } from '@/services/api/client';

export const logoutService = async () => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};
