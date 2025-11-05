import axios from "axios";

export const loginService = async (user: string, password: string) => {
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_MY_BACKEND_API}/auth/login`,
    {
      user,
      password,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true
    }
  );
  console.log(response);
  return response.data;  
};
