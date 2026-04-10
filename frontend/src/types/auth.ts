export type InputState = {
  username: string;
  password: string;
};

export type RegisterState = {
  username: string;
  password: string;
  email: string;
  companyId: string;
};

export type InputStatus = {
  hadValue: boolean;
  type: string;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

export type LoginResponse = {
  message: string;
  user: AuthUser;
  token: string;
};
