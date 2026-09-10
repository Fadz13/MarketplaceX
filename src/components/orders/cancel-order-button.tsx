"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/actions/order";

export function CancelOrderButton({
  orderId,
}: {
  orderId: string;
}) {
  const [pending, startTransition] =
    useTransition();
  const router = useRouter();

  function handleCancel() {
    if (
      !confirm(
        "Yakin ingin membatalkan pesanan ini?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await cancelOrder(orderId);

      if (result?.success) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleCancel}
      disabled={pending}
      className="w-full rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
    >
      {pending
        ? "Membatalkan..."
        : "Batalkan Pesanan"}
    </button>
  );
}
