import React from "react";
import { useState, useEffect } from "react";
import { InputState, RegisterState } from "@/types/auth";
import { loginService } from "@/services/auth/login";
import { useRouter } from 'next/navigation';
import axios from "axios";

export default function useRegisterForm() {
  const router = useRouter();
  const [successMessage, setsuccessMessage] = useState("")
  const [errorMessage, seterrorMessage] = useState("")
  const [handleInputs, sethandleInputs] = useState<RegisterState>({
    username: "",
    password: "",
    company: "",
    email: "",
    rnc: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    sethandleInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { username, password, company, email, rnc } = handleInputs;
      console.log(username, password, company, email, rnc);
      
      
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
