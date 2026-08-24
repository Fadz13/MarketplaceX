"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setMessage("Login berhasil, tetapi user tidak ditemukan.");
      setLoading(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("users")
      .select(`
        id,
        role,
        status
      `)
      .eq("auth_id", data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();

      setMessage(
        `Failed to load user profile: ${profileError.message}`,
      );

      setLoading(false);
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();

      setMessage(
        "User profile tidak ditemukan.",
      );

      setLoading(false);
      return;
    }

    if (profile.status !== "active") {
      await supabase.auth.signOut();

      setMessage(
        `Account is ${profile.status}.`,
      );

      setLoading(false);
      return;
    }

    switch (profile.role) {
      case "admin":
      case "super_admin":
        router.push("/dashboard");
        break;

      case "seller":
        router.push("/");
        break;

      case "buyer":
        router.push("/");
        break;

      case "finance":
      case "moderator":
        router.push("/dashboard");
        break;

      default:
        router.push("/");
        break;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-2xl font-bold">
          Login
        </h1>

        <input
          className="w-full rounded border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
        />

        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black p-2 text-white disabled:opacity-50"
        >
          {loading
            ? "Loading..."
            : "Login"}
        </button>

        {message && (
          <p className="text-sm text-red-600">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}