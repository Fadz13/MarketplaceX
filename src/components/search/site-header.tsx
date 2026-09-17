import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/search/search-bar";
import { AccountMenu } from "@/components/search/account-menu";

type Props = {
  searchQuery?: string | undefined;
};

export async function SiteHeader({ searchQuery }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let avatarUrl: string | null = null;
  let displayName = "";
  let email = "";

  if (user) {
    email = user.email ?? "";

    const { data: buyerRow } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (buyerRow) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, avatar_url")
        .eq("user_id", buyerRow.id)
        .maybeSingle();

      avatarUrl = profile?.avatar_url ?? null;
      displayName =
        profile?.full_name?.trim() || email.split("@")[0] || "Akun";
    } else {
      displayName = email.split("@")[0] || "Akun";
    }
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <Link href="/" className="shrink-0 text-xl font-bold">
          MarketplaceX
        </Link>

        <div className="hidden flex-1 justify-center sm:flex">
          <SearchBar initialQuery={searchQuery} />
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <AccountMenu
              avatarUrl={avatarUrl}
              displayName={displayName}
              email={email}
            />
          ) : (
            <Link
              href="/login"
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Login
            </Link>
          )}

          <Link
            href="/cart"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Cart
          </Link>
        </div>
      </div>

      <div className="border-t px-6 py-2 sm:hidden">
        <SearchBar initialQuery={searchQuery} />
      </div>
    </header>
  );
}
