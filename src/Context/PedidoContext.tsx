"use client";
import { createContext, useContext, useState } from "react";

type PedidoData = {
  proyecto?: string;
  servicio?: string;
  maquina?: string;
  material?: string;
  especificaciones?: {
    texto?: string;
    video?: string;
    archivos?: File[];
    fechaEntrega?: string;
  };
};

type PedidoContextType = {
  pedido: PedidoData;
  setPedido: React.Dispatch<React.SetStateAction<PedidoData>>;
};

const PedidoContext = createContext<PedidoContextType>({
  pedido: {},
  setPedido: () => {},
});

export const PedidoProvider = ({ children }: { children: React.ReactNode }) => {
  const [pedido, setPedido] = useState<PedidoData>({});
  return (
    <PedidoContext.Provider value={{ pedido, setPedido }}>
      {children}
    </PedidoContext.Provider>
  );
};

export const usePedido = () => useContext(PedidoContext);
