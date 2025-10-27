"use client";
import React, { use } from "react";
import useInputState from "@/hooks/auth/useInputState";


type InputsProps = {
  label?: any;
  type?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rounded?: boolean;
  value?: string;
  name?: string;
  icon?: string;
  min?: number;
  max?: number;
};

export default function Inputs({ name, label, type, value, icon, min, max, onChange, rounded }: InputsProps) {
    // This component renders an input field with a floating label that moves above the input when it has a value.
    const hadValue = useInputState(value || "", label);
  return (
    <div className={`relative flex items-center justify-center inputGroup w-3/4 mb-4 dark:text-white bg-gray-200 ${rounded ? "md:rounded lg:rounded" : "rounded"}`}>
      <input
        type={`${type}`}
        name={`${name || label?.toLowerCase()}`}
        value={value}
        min={min}
        max={max}
        className={`peer ${rounded ? "md:rounded lg:rounded overflow-hidden" : "rounded"} p-2 w-full outline-none dark:text-white text-black focus:shadow-md transition-all dark:border-black `}
        onChange={onChange}
      />
      <label
        className={`absolute dark:text-white text-black ${
          hadValue.hadValue && hadValue.type == label
            ? "top-[-20px] left-2"
            : "top-2 left-6"
        } pointer-events-none peer-focus:top-[-20px] peer-focus:left-2 transition-all`}
      >
        {icon && <i className={`bx ${icon} text-[1rem] mr-1.5`} />}
        {label}
      </label>
    </div>
  );
}
