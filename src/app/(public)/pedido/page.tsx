import type { Metadata } from "next";
import { Checkout } from "./checkout";

export const metadata: Metadata = {
  title: "Mi pedido",
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6 lg:pt-10">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Finalizar pedido</h1>
      <Checkout />
    </div>
  );
}
