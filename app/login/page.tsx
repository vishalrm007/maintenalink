"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    try {
      // Step 1: Authenticate user
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      // Step 2: Fetch user's role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setMessage("Unable to retrieve your profile. Please try again.");
        return;
      }

      if (!profile) {
        setMessage(
          "Your account exists, but your profile is missing. Please contact support."
        );
        return;
      }

      // Step 3: Redirect according to user role
      if (profile.role === "company") {
        router.replace("/company/dashboard");
      } else if (profile.role === "technician") {
        router.replace("/technician/dashboard");
      } else {
        setMessage("Invalid account role. Please contact support.");
        return;
      }

      router.refresh();

    } catch (error) {
      console.error("Login error:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">

      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"
      >

        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Back to MaintenaLink
        </Link>

        <h1 className="mt-6 text-3xl font-bold">
          Welcome back
        </h1>

        <p className="mt-2 text-slate-400">
          Sign in to your MaintenaLink account.
        </p>

        <div className="mt-8 space-y-5">

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Email Address
            </label>

            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 outline-none focus:border-blue-500"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Password
            </label>

            <div className="relative">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 pr-20 outline-none focus:border-blue-500"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-sm text-blue-400"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

        </div>

        {/* Error Message */}
        {message && (
          <div className="mt-5 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
            {message}
          </div>
        )}

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-7 w-full rounded-lg bg-white p-3 font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {/* Registration Link */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            Sign up
          </Link>
        </p>

      </form>

    </main>
  );
}