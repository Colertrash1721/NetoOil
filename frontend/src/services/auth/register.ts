import axios from "axios";

export const registerService = async (email: string, password: string, username: string, rnc: string, company: string) =>{
    const response = await axios.post(
    `${process.env.NEXT_PUBLIC_MY_BACKEND_API}/auth`,
    {
      email,
      password,
      username,
      rnc,
      company
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
}