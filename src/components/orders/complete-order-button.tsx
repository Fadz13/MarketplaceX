"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOrder } from "@/lib/actions/order";

export function CompleteOrderButton({
  orderId,
}: {
  orderId: string;
}) {
  const [pending, startTransition] =
    useTransition();
  const router = useRouter();

  function handleComplete() {
    if (
      !confirm(
        "Selesaikan pesanan ini? Penjual akan menerima pembayaran.",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result =
        await completeOrder(orderId);

      if (result?.success) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleComplete}
      disabled={pending}
      className="w-full rounded-lg border border-green-300 bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
    >
      {pending
        ? "Menyelesaikan..."
        : "Selesaikan Pesanan"}
    </button>
  );
}
