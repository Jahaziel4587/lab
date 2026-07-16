"use client";

import Link from "next/link";
import type { Pedido } from "../types";
import {
  calendarPedidoClass,
  pedidoDetailHref,
} from "../utils";

type PedidoCalendarioItemProps = {
  pedido: Pedido;
  isAdmin: boolean;
};

export default function PedidoCalendarioItem({
  pedido,
  isAdmin,
}: PedidoCalendarioItemProps) {
  const className = calendarPedidoClass(pedido.status);

  if (!isAdmin) {
    return (
      <div className={className} title={pedido.titulo}>
        {pedido.titulo}
      </div>
    );
  }

  return (
    <Link
      href={pedidoDetailHref(pedido)}
      className={className}
      title={pedido.titulo}
    >
      {pedido.titulo}
    </Link>
  );
}