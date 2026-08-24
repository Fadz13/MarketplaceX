"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    console.log("EMAIL =", JSON.stringify(email));
    console.log("PASSWORD =", JSON.stringify(password));

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    console.log("DATA =", data);
    console.log("ERROR =", error);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("✅ Registrasi berhasil");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md space-y-4 rounded-lg border p-6"
      >
        <h1 className="text-2xl font-bold">
          Register
        </h1>

        <input
          className="w-full rounded border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full rounded bg-black p-2 text-white"
        >
          Daftar
        </button>

        <p>{message}</p>
      </form>
    </main>
  );
}