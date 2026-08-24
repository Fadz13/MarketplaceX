import { createClient } from "@/lib/supabase/server";
import { WithdrawalsClient } from "@/components/withdrawals/withdrawals-client";

type Withdrawal = {
  id: string;
  seller_id: string;
  seller_email: string | null;
  store_name: string | null;
  amount: number;
  fee_amount: number;
  net_amount: number | null;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  status: string;
  reference_no: string | null;
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
};

export default async function WithdrawalsPage() {
  const supabase = await createClient();

  const [
    { data: withdrawals, error: withdrawalsError },
    { data: users, error: usersError },
    { data: stores, error: storesError },
  ] = await Promise.all([
    supabase
      .from("seller_withdrawals")
      .select(`
        id,
        seller_id,
        amount,
        fee_amount,
        net_amount,
        bank_name,
        bank_account_no,
        bank_account_name,
        status,
        reference_no,
        created_at,
        processed_at,
        completed_at
      `)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("users")
      .select(`
        id,
        email
      `),

    supabase
      .from("stores")
      .select(`
        id,
        seller_id,
        store_name
      `),
  ]);

  if (withdrawalsError) {
    throw new Error(
      withdrawalsError.message,
    );
  }

  if (usersError) {
    throw new Error(usersError.message);
  }

  if (storesError) {
    throw new Error(storesError.message);
  }

  const userMap = new Map(
    (users ?? []).map((user) => [
      user.id,
      user,
    ]),
  );

  const storeMap = new Map(
    (stores ?? []).map((store) => [
      store.seller_id,
      store,
    ]),
  );

  const formatted: Withdrawal[] =
    (withdrawals ?? []).map(
      (withdrawal) => {
        const user = userMap.get(
          withdrawal.seller_id,
        );

        const store =
          storeMap.get(
            withdrawal.seller_id,
          );

        return {
          id: withdrawal.id,
          seller_id:
            withdrawal.seller_id,
          seller_email:
            user?.email ?? null,
          store_name:
            store?.store_name ?? null,
          amount: Number(
            withdrawal.amount ?? 0,
          ),
          fee_amount: Number(
            withdrawal.fee_amount ?? 0,
          ),
          net_amount:
            withdrawal.net_amount === null
              ? null
              : Number(
                  withdrawal.net_amount,
                ),
          bank_name:
            withdrawal.bank_name,
          bank_account_no:
            withdrawal.bank_account_no,
          bank_account_name:
            withdrawal.bank_account_name,
          status:
            withdrawal.status,
          reference_no:
            withdrawal.reference_no,
          created_at:
            withdrawal.created_at,
          processed_at:
            withdrawal.processed_at,
          completed_at:
            withdrawal.completed_at,
        };
      },
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Withdrawals
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage seller withdrawal requests.
        </p>
      </div>

      <WithdrawalsClient
        withdrawals={formatted}
      />
    </div>
  );
}