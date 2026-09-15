import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddressListClient } from "@/components/addresses/address-list";

export const metadata = {
  title: "Alamat Saya — MarketplaceX",
};

export default async function AddressesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/addresses");
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!buyerRow) {
    redirect("/login?next=/account/addresses");
  }

  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", buyerRow.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/account"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Akun
          </Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-xl font-semibold">Alamat Saya</h1>
        </div>

        <AddressListClient addresses={(addresses ?? []) as any[]} />
      </div>
    </div>
  );
}
