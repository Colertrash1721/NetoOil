'use client';
import { createContext, useContext, ReactNode } from "react";
import { useState } from "react";

interface AuthRegister{
    isRegistering: boolean;
    setisRegistering?: (value: boolean) => void;
}

const AuthRegisterContext = createContext<AuthRegister | undefined>(undefined);

export const useAuthRegister = () => {
    const context = useContext(AuthRegisterContext);
    if (context === undefined) {
        throw new Error("useAuthRegister must be used within an AuthRegisterProvider");
    }
    return context;
}

export const AuthRegisterProvider = ({children}: {children: ReactNode}) => {
    const [isRegistering, setisRegistering] = useState(false);

    return (
        <AuthRegisterContext.Provider value={{isRegistering, setisRegistering}}>
            {children}
        </AuthRegisterContext.Provider>
    );
}