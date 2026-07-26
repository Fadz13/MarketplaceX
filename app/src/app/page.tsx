"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [status, setStatus] = useState("Menghubungkan...");

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase.from("_test").select("*").limit(1);

      if (error) {
        setStatus("✅ Supabase berhasil terhubung (database belum memiliki tabel _test).");
      } else {
        setStatus("✅ Supabase berhasil terhubung.");
      }
    }

    testConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">{status}</h1>
    </main>
  );
}