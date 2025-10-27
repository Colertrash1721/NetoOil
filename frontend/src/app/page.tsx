'use client';
import React from "react";
import { useAuthRegister } from "@/hooks/auth/providers";
import LoginForm from "../components/auth/loginForm";
import RegisterForm from "../components/auth/registerForm";
import Image from "next/image";
import clsx from "clsx";

export default function Home() {
  const { isRegistering } = useAuthRegister();
  return (
    <>
      {/* Background animation that expands when registering is true */}
      <div className={clsx(
        "fixed lg:fixed inset-0 z-30 bg-[#6C9BF5] transition-[clip-path] duration-700 ease-out",
        !isRegistering && "[clip-path:circle(6rem_at_100%_10%)]",
        isRegistering && "[clip-path:circle(150%_at_100%_10%)]"
      )}>
      </div>
      {/* Visible ball animation on the top right corner  */}
      <div className={`group fixed lg:block md:block bg-[#6C9BF5] z-1 rounded-full w-64 h-64 top-[-5%] md:top-[-5%] md:right-[-5%] animate-rotate-slow right-[-10%] transition-all duration-1000`}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <div
            key={deg}
            className="absolute w-10 h-10 bg-[#6C9BF5] rounded-full transition z-[200] duration-700 ease-out block md:block"
            style={{
              top: "40%",
              left: "50%",
              transform: `rotate(${deg}deg) translate(200px) rotate(-${deg}deg)`,
              transformOrigin: "center center",
            }}
          ></div>
        ))}
      </div>
      {isRegistering ? <RegisterForm /> :
        <main className="flex flex-1
         md:grid lg:grid lg:grid-cols-[60%_40%] md:grid-cols-2 h-full">
          <section className="hidden md:block lg:block w-full h-full">
            <div className="md:flex lg:flex items-center justify-center h-full overflow-hidden [clip-path:polygon(0_0,100%_0,60%_100%,0_100%)] bg-[url(/assets/DominicanRepublic.jpg)] h-full w-full bg-cover bg-bottom">
            <div className="bg-[#6C9BF580] h-full w-full"></div>
            </div>
          </section>
          <section className="w-full h-full">
            <LoginForm />
          </section>
        </main>
      }
    </>
  );
}
