import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profile";
import { ProfileContent } from "@/components/account/profile-content";

export const metadata = {
  title: "Profil Saya — MarketplaceX",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/profile");
  }

  const {
    data: buyerRow,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!buyerRow) {
    redirect("/login?next=/account/profile");
  }

  const profile = await getProfile();

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
          <h1 className="text-xl font-semibold">Profil Saya</h1>
        </div>

        <ProfileContent profile={profile} />
      </div>
    </div>
  );
}
