import { createClient } from "@/lib/supabase/server";
import { WithdrawalForm } from "@/components/withdrawals/withdrawal-form";

export default async function WithdrawPage() {
  const supabase = await createClient();

  const {
    data: {
      user: authUser,
    },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Unauthorized.");
  }

  const {
    data: user,
    error: userError,
  } = await supabase
    .from("users")
    .select(`
      id,
      role
    `)
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user || user.role !== "seller") {
    throw new Error(
      "Only sellers can request withdrawals.",
    );
  }

  const {
    data: balance,
    error: balanceError,
  } = await supabase
    .from("seller_balances")
    .select(`
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn
    `)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (balanceError) {
    throw new Error(
      balanceError.message,
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Withdraw
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Request a withdrawal from your seller balance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Available
          </p>

          <p className="mt-1 text-lg font-bold">
            Rp{" "}
            {Number(
              balance?.available_balance ??
                0,
            ).toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Pending
          </p>

          <p className="mt-1 text-lg font-bold">
            Rp{" "}
            {Number(
              balance?.pending_balance ??
                0,
            ).toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            Total Earned
          </p>

          <p className="mt-1 text-lg font-bold">
            Rp{" "}
            {Number(
              balance?.total_earned ??
                0,
            ).toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <WithdrawalForm
        availableBalance={Number(
          balance?.available_balance ??
            0,
        )}
      />
    </div>
  );
}