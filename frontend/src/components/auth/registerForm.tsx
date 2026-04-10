'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useAuthRegister } from '@/hooks/auth/providers';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Inputs from '../ui/inputs';
import useRegisterForm from '@/hooks/auth/useRegisterForm';
import { LoginFail, LoginSucess } from '../ui/alert';

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function RegisterForm() {
  const { setisRegistering } = useAuthRegister();
  const {
    companies,
    loadingCompanies,
    handleChange,
    handleSubmit,
    handleInputs,
    errorMessage,
    successMessage,
  } = useRegisterForm();

  const [display, setDisplay] = useState('');
  const phrases = ['¿Ya tienes una cuenta?', 'Do you have an account?', 'Hast du schon ein Konto?'];

  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (started.current) return;
    started.current = true;

    const type = async () => {
      const letterDelay = 80;
      const endPause = 900;
      const clearDelay = 30;
      let current = '';

      while (mounted.current) {
        for (const phrase of phrases) {
          for (const ch of phrase) {
            if (!mounted.current) return;
            current += ch;
            setDisplay(current);
            await wait(letterDelay);
          }

          await wait(endPause);

          for (let i = current.length; i > 0; i -= 1) {
            if (!mounted.current) return;
            current = current.slice(0, -1);
            setDisplay(current);
            await wait(clearDelay);
          }

          await wait(300);
        }
      }
    };

    void type();

    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <main className='relative flex h-full w-full items-center justify-center'>
      {errorMessage && <LoginFail descriptionFail={errorMessage} />}
      {successMessage && <LoginSucess descriptionSucess={successMessage} />}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 } }}
        className='absolute z-[100] flex h-full w-full flex-col-reverse justify-between text-3xl font-bold text-white md:grid md:h-3/4 md:w-3/4 md:grid-cols-2 md:rounded-2xl lg:grid-cols-[30%_60%]'
      >
        <section className='relative flex h-[30%] flex-col items-center justify-center gap-8 md:h-full'>
          <div className='absolute right-[-50%] z-[1] flex h-full w-full flex-col items-start justify-between overflow-hidden rounded-l-2xl py-30'>
            <div className='flex flex-col gap-6'>
              <h1 className='min-h-[2.5rem] text-3xl font-extrabold text-black md:text-white'>
                {display}
                <span className='animate-pulse'>|</span>
              </h1>

              <p className='text-lg font-light text-black md:text-white'>Si ya tienes una cuenta clickea aquí para ingresar</p>
              <button
                className='group relative w-auto cursor-pointer overflow-hidden rounded-full bg-blue-600 p-2 px-4 text-2xl font-medium tracking-[2px] shadow-lg transition-all after:absolute after:left-[-100%] after:top-0 after:z-[-1] after:h-full after:w-full after:bg-[#49CDD0] after:transition-[left] after:duration-300 after:content-[""] hover:border-0 hover:after:left-0 lg:w-1/2 md:w-1/2'
                onClick={() => setisRegistering && setisRegistering(false)}
              >
                <span>Click aquí</span>
              </button>
            </div>

            <Image className='bottom-0 right-0 z-[-1]' src='/assets/imagen.png' alt='' width={650} height={650} />
          </div>
        </section>

        <section className='mt-10 flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/22 bg-[#ffffff27] shadow-lg backdrop-blur-sm md:mt-0'>
          <h1 className='text-4xl font-extrabold text-black'>Sign Up</h1>
          <form className='flex w-3/4 flex-col items-end justify-center gap-4 text-xl font-light text-black' onSubmit={handleSubmit}>
            <Inputs type='text' label='Username' icon='bx-user' rounded onChange={handleChange} value={handleInputs.username} />
            <Inputs type='text' label='Email' icon='bxl-gmail' rounded onChange={handleChange} value={handleInputs.email} />
            <Inputs type='password' label='Password' icon='bx-lock-alt' rounded onChange={handleChange} value={handleInputs.password} />
            <div className='relative flex items-center justify-center inputGroup w-3/4 mb-4 text-black bg-gray-200 rounded'>
              <select
                name='companyId'
                value={handleInputs.companyId}
                onChange={handleChange}
                className='rounded p-2 w-full outline-none text-black border-black focus:shadow-md transition-all bg-transparent'
              >
                <option value=''>{loadingCompanies ? 'Cargando empresas...' : 'Selecciona una empresa'}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <button className='w-2/5 cursor-pointer rounded-full bg-[#6C9BF5] px-6 py-2 tracking-[2px] text-white transition hover:bg-blue-600 md:w-3/4 md:rounded'>Register</button>
          </form>
        </section>
      </motion.div>
    </main>
  );
}
