'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useAuthRegister } from '@/hooks/auth/providers';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Inputs from '../ui/inputs';
import useRegisterForm from '@/hooks/auth/useRegisterForm';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function RegisterForm() {
  const { setisRegistering } = useAuthRegister();
  const { handleChange, handleSubmit, handleInputs } = useRegisterForm();

  // usa string, no array
  const [display, setDisplay] = useState('');
  const phrases = [
    "¿Ya tienes una cuenta?",
    "Do you have an account?",
    "Hast du schon ein Konto?"
  ];

  // evita doble arranque en StrictMode
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (started.current) return;
    started.current = true;

    const type = async () => {
      const letterDelay = 80;   // velocidad por letra
      const endPause = 900;   // pausa al terminar una frase
      const clearDelay = 30;    // velocidad de borrado

      // buffer local, no dependas del estado para contar
      let current = '';

      while (mounted.current) {
        for (const phrase of phrases) {
          // escribir
          for (const ch of phrase) {
            if (!mounted.current) return;
            current += ch;
            setDisplay(current);
            await wait(letterDelay);
          }

          await wait(endPause);

          // borrar
          for (let i = current.length; i > 0; i--) {
            if (!mounted.current) return;
            current = current.slice(0, -1);
            setDisplay(current);
            await wait(clearDelay);
          }

          await wait(300); // pausa entre frases
        }
      }
    };

    type();

    return () => { mounted.current = false; };
  }, []);

  return (
    <main className='h-full w-full flex items-center justify-center relative'>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, scale: { type: "spring", visualDuration: 0.4, bounce: 0.5 } }}
        className="absolute flex flex-col-reverse md:grid z-[100] text-white font-bold text-3xl bg-white w-full h-full md:w-3/4 md:h-3/4  md:rounded-2xl shadow-lg lg:grid-cols-[60%_40%] md:grid-cols-2 justify-between"
      >
        <section className='relative flex flex-col items-center justify-center gap-8 h-[30%] md:h-full'>
          <div className="absolute z-[-1] bg-[#9EBFFF] flex items-center justify-center h-full w-full overflow-hidden [clip-path:circle(85%_at_40%_170%)] md:[clip-path:circle(85%_at_0%_50%)] rounded-l-2xl" />

          {/* Texto tipeado */}
          <h1 className='text-3xl text-black md:text-white font-extrabold min-h-[2.5rem]'>
            {display}<span className='animate-pulse'>|</span>
          </h1>

          <p className='text-black md:text-white text-lg font-light'>Si ya tienes una cuenta clickea aquí para ingresar</p>
          <button
            className='group rounded-full relative border p-2 px-4 text-2xl overflow-hidden font-medium tracking-[2px] cursor-pointer transition-all after:absolute after:content-[""] after:w-full after:h-full after:bg-[#49CDD0] after:top-0 after:left-[-100%] after:z-[-1] hover:after:left-0 hover:border-0 after:transition-[left] after:duration-300'
            onClick={() => setisRegistering && setisRegistering(false)}
          >
            <span>Click aquí</span>
          </button>

          <Image className='absolute bottom-0 right-0 z-[-1]' src="/assets/raw.png" alt='' width={450} height={450} />
        </section>

        <section className='flex flex-col items-center justify-center gap-3 mt-10 md:mt-0'>
          <h1 className='text-4xl text-black font-extrabold'>Sign Up</h1>
          <form className='w-full text-xl text-black font-light flex flex-col items-center justify-center gap-4' onSubmit={handleSubmit}>
            <Inputs type='text' label="Username" icon='bx-user' rounded onChange={handleChange} value={handleInputs.username} />
            <Inputs type='text' label="Email" icon='bxl-gmail' rounded onChange={handleChange} value={handleInputs.email} />
            <Inputs type='password' label="Password" icon='bx-lock-alt' rounded onChange={handleChange} value={handleInputs.password} />
            <Inputs type='text' label="Company" icon='bxs-business' onChange={handleChange} value={handleInputs.company} />
            <Inputs type='text' label="Rnc" icon='bxs-business' rounded onChange={handleChange} value={handleInputs.rnc} />
            <button className='rounded-full w-2/5 md:w-3/4 bg-[#6C9BF5] text-white px-6 py-2 md:rounded hover:bg-blue-600 transition tracking-[2px] cursor-pointer'>Register</button>

          </form>
        </section>
      </motion.div>
    </main>
  );
}
