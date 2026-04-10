import { apiClient } from '@/services/api/client';

export type UserApi = {
  id: number;
  username: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  creationDate: string;
  lastConnection: string | null;
  companyId: number;
  companyName: string;
};

export const getUsersService = async () => {
  const response = await apiClient.get<UserApi[]>('/users/');
  return response.data;
};

export const updateUserStatusService = async (
  userId: number,
  status: UserApi['status'],
) => {
  const response = await apiClient.patch<UserApi>(`/users/${userId}/status`, { status });
  return response.data;
};
