import React from "react";
import { useState, useEffect } from "react";
import { InputState } from "@/types/auth";
import { loginService } from "@/services/auth/login";
import { useRouter } from 'next/navigation';
import axios from "axios";

export default function useLoginForm() {
  const router = useRouter();
  const [successMessage, setsuccessMessage] = useState("")
  const [errorMessage, seterrorMessage] = useState("")
  const [handleInputs, sethandleInputs] = useState<InputState>({
    username: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    sethandleInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { username, password } = handleInputs;
      const loginResponse = await loginService(username, password);
      console.log(loginResponse);
      localStorage.setItem("username", loginResponse.user.username);
      localStorage.setItem("token", loginResponse.token);
      localStorage.setItem("rol", loginResponse.user.role);
      setsuccessMessage("✅ Autenticación completa");
      setTimeout(() => {
        if (loginResponse.user.role === 'admin') {
          router.push('/dashboard');
        }
        else{
          router.push('/container');
        }
      }, 3000);
      
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log(error.response?.data);
        seterrorMessage(error.response?.data.message)
      } else {
        console.log("Error desconocido:", error);
        seterrorMessage(error.response?.data.message)
      }
    }
  };

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => seterrorMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setsuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return { handleInputs, handleChange, handleSubmit, successMessage, errorMessage };
}
