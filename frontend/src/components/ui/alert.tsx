import React from "react";

type loginFail = {
  descriptionFail: any;
};
type loginSuccess = {
  descriptionSucess: any;
};

export function LoginFail({ descriptionFail }: loginFail) {
  return (
    <div className="flex fixed bg-red-500 flex-col w-[25%] h-50 rounded-lg top-10 left-1/2 transform -translate-x-1/2 text-white justify-center items-center shadow-lg z-50 text-2xl gap-2">
      <div className="icon flex flex-row justify-between">
        <i className="bx bx-error-circle text-2xl"></i>
        <h1>Opss!!!</h1>
      </div>
      <div className="alert">
        <p>{descriptionFail}</p>
      </div>
    </div>
  );
}
export function LoginSucess({ descriptionSucess }: loginSuccess) {
  return (
    <div className="flex fixed bg-green-500 flex-col w-[25%] h-50 rounded-lg top-10 left-1/2 transform -translate-x-1/2 text-white justify-center items-center shadow-lg z-50 text-2xl gap-2">
      <div className="icon flex flex-row justify-around">
        <i className="bx bx-check-circle text-2xl"></i>
        <h1>Good!!!</h1>
      </div>
      <div className="alert">
        <p>{descriptionSucess}</p>
      </div>
    </div>
  );
}
