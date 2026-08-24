import { createClient } from "@/lib/supabase/server";
import { SellersClient } from "@/components/sellers/sellers-client";

type Seller = {
  id: string;
  email: string;
  role: string;
  status: string;

  store_id: string;
  store_name: string;
  store_status: string;
  rating: number;
  review_count: number;
  follower_count: number;
  total_sales: number;
  total_revenue: number;

  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
};

export default async function SellersPage() {
  const supabase = await createClient();

  const [
    { data: stores, error: storesError },
    { data: users, error: usersError },
    { data: balances, error: balancesError },
  ] = await Promise.all([
    supabase
      .from("stores")
      .select(`
        id,
        seller_id,
        store_name,
        status,
        rating,
        review_count,
        follower_count,
        total_sales,
        total_revenue
      `)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("users")
      .select(`
        id,
        email,
        role,
        status
      `),

    supabase
      .from("seller_balances")
      .select(`
        seller_id,
        available_balance,
        pending_balance,
        total_earned,
        total_withdrawn
      `),
  ]);

  if (storesError) {
    throw new Error(
      `Failed to load stores: ${storesError.message}`,
    );
  }

  if (usersError) {
    throw new Error(
      `Failed to load users: ${usersError.message}`,
    );
  }

  if (balancesError) {
    throw new Error(
      `Failed to load seller balances: ${balancesError.message}`,
    );
  }

  const usersMap = new Map(
    (users ?? []).map((user) => [
      user.id,
      user,
    ]),
  );

  const balancesMap = new Map(
    (balances ?? []).map((balance) => [
      balance.seller_id,
      balance,
    ]),
  );

  const sellers: Seller[] =
    (stores ?? []).map((store) => {
      const user = usersMap.get(
        store.seller_id,
      );

      const balance =
        balancesMap.get(
          store.seller_id,
        );

      return {
        id: store.seller_id,

        email:
          user?.email ??
          "Unknown seller",

        role:
          user?.role ??
          "unknown",

        status:
          user?.status ??
          "unknown",

        store_id: store.id,
        store_name: store.store_name,
        store_status: store.status,

        rating: Number(
          store.rating ?? 0,
        ),

        review_count: Number(
          store.review_count ?? 0,
        ),

        follower_count: Number(
          store.follower_count ?? 0,
        ),

        total_sales: Number(
          store.total_sales ?? 0,
        ),

        total_revenue: Number(
          store.total_revenue ?? 0,
        ),

        available_balance:
          Number(
            balance?.available_balance ??
              0,
          ),

        pending_balance:
          Number(
            balance?.pending_balance ??
              0,
          ),

        total_earned:
          Number(
            balance?.total_earned ??
              0,
          ),

        total_withdrawn:
          Number(
            balance?.total_withdrawn ??
              0,
          ),
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Sellers
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage sellers, stores, and seller balances.
        </p>
      </div>

      <SellersClient
        sellers={sellers}
      />
    </div>
  );
}