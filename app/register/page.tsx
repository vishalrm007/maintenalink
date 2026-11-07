"use client";

import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialRole =
    searchParams.get("role") === "company" ? "company" : "technician";

  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage(
        "Registration successful. Check your email to confirm your account."
      );
    } else {
      router.push(
        role === "company"
          ? "/company/dashboard"
          : "/technician/dashboard"
      );
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"
      >
        <h1 className="text-3xl font-bold">Create your account</h1>

        <p className="mt-2 text-slate-400">
          Join the MaintenaLink industrial maintenance marketplace.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("company")}
            className={`rounded-lg border p-3 ${
              role === "company"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700"
            }`}
          >
            Company
          </button>

          <button
            type="button"
            onClick={() => setRole("technician")}
            className={`rounded-lg border p-3 ${
              role === "technician"
                ? "border-white bg-white text-slate-950"
                : "border-slate-700"
            }`}
          >
            Technician
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg bg-slate-800 p-3 outline-none"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <input
            className="w-full rounded-lg bg-slate-800 p-3 outline-none"
            placeholder="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            className="w-full rounded-lg bg-slate-800 p-3 outline-none"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded-lg bg-slate-800 p-3 outline-none"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <button
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-white p-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        {message && (
          <p className="mt-4 rounded-lg bg-slate-800 p-3 text-sm text-slate-300">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}