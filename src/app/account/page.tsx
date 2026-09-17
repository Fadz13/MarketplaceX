import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Akun Saya — MarketplaceX",
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id, email")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!buyerRow) {
    redirect("/login?next=/account");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, avatar_url")
    .eq("user_id", buyerRow.id)
    .maybeSingle();

  const { count: addressCount } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", buyerRow.id);

  const displayName =
    profile?.full_name?.trim() || buyerRow.email.split("@")[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Akun Saya</h1>
        <p className="mb-8 text-sm text-gray-500">
          Kelola profil, alamat, dan pesanan Anda.
        </p>

        <div className="mb-8 rounded-2xl border bg-white p-5">
          <p className="text-sm text-gray-500">Masuk sebagai</p>
          <p className="mt-1 font-medium">{displayName}</p>
          <p className="text-sm text-gray-500">{buyerRow.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/account/profile" className="group block">
            <div className="rounded-2xl border bg-white p-5 transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <h2 className="font-semibold">Profil</h2>
              </div>
              <p className="text-sm text-gray-500">
                Perbarui nama, foto, dan informasi pribadi Anda.
              </p>
            </div>
          </Link>

          <Link href="/account/addresses" className="group block">
            <div className="rounded-2xl border bg-white p-5 transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <h2 className="font-semibold">Alamat</h2>
                {addressCount != null && addressCount > 0 && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {addressCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Kelola alamat pengiriman untuk pesanan Anda.
              </p>
            </div>
          </Link>

          <Link href="/orders" className="group block">
            <div className="rounded-2xl border bg-white p-5 transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                </span>
                <h2 className="font-semibold">Pesanan</h2>
              </div>
              <p className="text-sm text-gray-500">
                Lihat riwayat dan status pesanan Anda.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
