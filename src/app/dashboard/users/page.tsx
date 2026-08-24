import { createClient } from "@/lib/supabase/server";
import { UsersClient } from "@/components/users/users-client";

type User = {
  id: string;
  email: string;
  role: string;
  status: string;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
};

export default async function UsersPage() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("users")
    .select(`
      id,
      email,
      role,
      status,
      email_verified,
      last_login_at,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const users: User[] =
    (data ?? []).map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      email_verified:
        user.email_verified,
      last_login_at:
        user.last_login_at,
      created_at:
        user.created_at,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Users
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage MarketplaceX users.
        </p>
      </div>

      <UsersClient
        users={users}
      />
    </div>
  );
}