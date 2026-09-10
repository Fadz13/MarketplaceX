import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WithdrawalForm } from "@/components/withdrawals/withdrawal-form";

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  processing: "Diproses",
  completed: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

export default async function SellerWithdrawPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/seller/withdraw");
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRow) {
    redirect("/login?next=/seller/withdraw");
  }

  const [
    { data: balance },
    { data: withdrawals },
  ] = await Promise.all([
    supabase
      .from("seller_balances")
      .select(
        "available_balance, pending_balance, total_earned, total_withdrawn",
      )
      .eq("seller_id", userRow.id)
      .maybeSingle(),

    supabase
      .from("seller_withdrawals")
      .select(
        "id, amount, net_amount, bank_name, status, created_at",
      )
      .eq("seller_id", userRow.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Penarikan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Tarik dana dari saldo seller Anda.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Tersedia
          </p>
          <p className="mt-1 text-lg font-bold">
            {formatPrice(
              balance?.available_balance ?? 0,
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Pending
          </p>
          <p className="mt-1 text-lg font-bold">
            {formatPrice(
              balance?.pending_balance ?? 0,
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Total Diperoleh
          </p>
          <p className="mt-1 text-lg font-bold">
            {formatPrice(
              balance?.total_earned ?? 0,
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Total Ditarik
          </p>
          <p className="mt-1 text-lg font-bold">
            {formatPrice(
              balance?.total_withdrawn ?? 0,
            )}
          </p>
        </div>
      </div>

      <WithdrawalForm
        availableBalance={Number(
          balance?.available_balance ?? 0,
        )}
      />

      {withdrawals && withdrawals.length > 0 && (
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Riwayat Penarikan
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-5 py-3 text-left font-medium">
                    Tanggal
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    Jumlah
                  </th>
                  <th className="px-5 py-3 text-left font-medium">
                    Bank
                  </th>
                  <th className="px-5 py-3 text-center font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b"
                  >
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(
                        w.created_at,
                      ).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {formatPrice(w.amount)}
                    </td>
                    <td className="px-5 py-3">
                      {w.bank_name}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          w.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : w.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : w.status ===
                                  "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[w.status] ??
                          w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
