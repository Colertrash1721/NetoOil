import React from 'react'
import { InputStatus } from "@/types/auth";
import { useState, useEffect } from "react";

export default function useInputState(value: string, label?: string) {
    // This hook manages the state of an input field, tracking whether it has a value and its type. to make the label dynamic float above the input when it has a value.
    const [hadValue, sethadValue] = useState<InputStatus>({
        hadValue: false,
        type: "",
      });
    
      useEffect(() => {
        if (label && value) {
          sethadValue({ hadValue: true, type: label || "" });
        } else {
          sethadValue({ hadValue: false, type: "" });
        }
      }, [value]);
      
  return hadValue;
}
