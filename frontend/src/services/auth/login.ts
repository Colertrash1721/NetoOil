import axios from "axios";

export const loginService = async (email: string, password: string) => {
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_MY_BACKEND_API}/auth/login`,
    {
      email,
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
