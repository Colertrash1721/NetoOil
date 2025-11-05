import React from 'react'
import { useState } from 'react';

type props = {
    className: string;
    title: string;
    options?: string[];
    returnSelectedOption: (option: string) => void;
}

export default function DropDown({ className, title, options, returnSelectedOption}: props) {
    const [isOpen, setisOpen] = useState<boolean>(false);
    const [selectedOption, setselectedOption] = useState<string | null>(null);

    const sendOption = (option: string) => {
        returnSelectedOption(option!);
    }

    const toggleOpen = () => {
        setisOpen(!isOpen);
    }

  return (
    <>
        <div className={className} onClick={toggleOpen}>
            {selectedOption ? selectedOption : title} <i className={isOpen ? 'bx bx-chevron-up' : 'bx bx-chevron-down'}></i>
        {isOpen && (
            <div className="absolute mt-2 w-full bg-white border-gray-300 rounded shadow-lg z-10 top-full left-0 transition-all border-0 overflow-hidden">
                {options?.map((option, index) => (
                    <div 
                        key={index} 
                        className="px-4 py-2 cursor-pointer hover:bg-blue-400 hover:text-white"
                        onClick={() => {
                            setselectedOption(option);
                            setisOpen(false);
                            sendOption(option);
                        }}
                    >
                        {option}
                    </div>
                ))}
            </div>
        )}
        </div>
    </>
  )
}
