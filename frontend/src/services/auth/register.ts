import { apiClient } from '@/services/api/client';

type RegisterResponse = {
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
};

export const registerService = async (
  username: string,
  password: string,
  email: string,
  companyId: number,
) => {
  const response = await apiClient.post<RegisterResponse>('/auth/register', {
    username,
    password,
    email,
    companyId,
  });

  return response.data;
};
