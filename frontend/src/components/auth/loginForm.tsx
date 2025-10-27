'use client';
import React from 'react'
import Image from 'next/image'
import Inputs from '../ui/inputs'
import { useAuthRegister } from '@/hooks/auth/providers'
import useLoginForm from '@/hooks/auth/useLoginForm';
import { LoginFail, LoginSucess } from '../ui/alert';

export default function LoginForm() {
  const { setisRegistering } = useAuthRegister();
  const { handleChange, handleSubmit, handleInputs, errorMessage, successMessage } = useLoginForm();
  return (
    <div className='flex items-center justify-center h-full gap-3 flex-col'>
      {errorMessage && <LoginFail descriptionFail={errorMessage} />}
      {successMessage && <LoginSucess descriptionSucess={successMessage} />}
      <div className="rounded-full overflow-hidden mb-8">
        <Image src="/assets/image.png" alt="Logo" width={200} height={150} />
      </div>
      <form className="w-full flex flex-col items-center justify-center gap-4" onSubmit={handleSubmit}>
        <Inputs
          type='text'
          label={"Username"}
          icon='bx-user'
          onChange={handleChange}
          value={handleInputs.username}
        />
        <Inputs
          type='password'
          label={"Password"}
          icon='bx-lock-alt'
          onChange={handleChange}
          value={handleInputs.password}
        />
      <button
        type='submit'
        className='w-3/4 bg-[#6C9BF5] text-white px-6 py-2 rounded hover:bg-blue-600 transition tracking-[2px] cursor-pointer'
      >
        Login
      </button>
      <button
        type="button"
        className='w-3/4 bg-black text-white px-6 py-2 rounded hover:bg-[#002147] hover:text-[D2B48C] hover:shadow-md transition tracking-[2px] cursor-pointer'
        onClick={() => setisRegistering && setisRegistering(true)}
      >
        Register
      </button>
      </form>
    </div>
  )
}
