"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmOrderReceived } from "@/lib/actions/order";

export function ConfirmReceivedButton({
  orderId,
}: {
  orderId: string;
}) {
  const [pending, startTransition] =
    useTransition();
  const router = useRouter();

  function handleConfirm() {
    if (
      !confirm(
        "Konfirmasi bahwa Anda telah menerima pesanan ini?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result =
        await confirmOrderReceived(orderId);

      if (result?.success) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={pending}
      className="w-full rounded-lg border border-cyan-300 bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
    >
      {pending
        ? "Mengkonfirmasi..."
        : "Pesanan Diterima"}
    </button>
  );
}
