"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type CompanyProfile = {
  id: string;
  role: string;
  full_name: string | null;
};

export default function CompanyDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Company User");
  const [companyName, setCompanyName] = useState("");
  const [companyProfileMissing, setCompanyProfileMissing] =
    useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Unable to load profile:", profileError);
        setLoading(false);
        return;
      }

      if (!profile) {
        setLoading(false);
        return;
      }

      const typedProfile = profile as CompanyProfile;

      if (typedProfile.role !== "company") {
        router.replace("/technician/dashboard");
        return;
      }

      setUserName(
        typedProfile.full_name || user.email || "Company User"
      );

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("company_name")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (companyError) {
        console.error("Unable to load company details:", companyError);
      }

      if (!company) {
        setCompanyProfileMissing(true);
      } else {
        setCompanyName(company.company_name);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-300">
          Loading company dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              MaintenaLink
            </h1>
            <p className="text-sm text-slate-400">
              Industrial Maintenance Marketplace
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* Welcome Section */}
        <section className="mb-8">
          <p className="text-sm font-medium text-blue-400">
            COMPANY DASHBOARD
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Welcome, {userName}
          </h2>

          {companyName && (
            <p className="mt-2 text-slate-300">
              {companyName}
            </p>
          )}

          <p className="mt-2 text-slate-400">
            Find skilled maintenance professionals and manage your
            maintenance requirements in one place.
          </p>
        </section>

        {/* Company Profile Alert */}
        {companyProfileMissing && (
          <section className="mb-8 rounded-xl border border-amber-700/60 bg-amber-950/40 p-5">
            <h3 className="font-semibold text-amber-300">
              Complete your company profile
            </h3>

            <p className="mt-2 text-sm text-amber-200/80">
              Your login account exists, but company details have not
              been created yet. Complete your company profile before
              posting jobs.
            </p>

            <Link
              href="/company/profile"
              className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Complete Company Profile
            </Link>
          </section>
        )}

        {/* Dashboard Cards */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

          {/* Find Technicians */}
          <Link
            href="/company/technicians"
            className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-sm transition hover:border-blue-500 hover:bg-slate-800"
          >
            <div className="text-3xl">👷</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Find Technicians
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Search professionals by city, experience and technical
              skills.
            </p>

            <span className="mt-5 inline-block font-semibold text-blue-400">
              Browse technicians →
            </span>
          </Link>

          {/* Post Maintenance Job */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-3xl">🛠️</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Post a Maintenance Job
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Publish requirements for breakdown maintenance,
              preventive maintenance and installations.
            </p>

            <span className="mt-5 inline-block text-sm text-slate-500">
              Coming in M6
            </span>
          </div>

          {/* My Jobs */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-3xl">📋</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              My Jobs
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Review your posted maintenance requirements and assigned
              technicians.
            </p>

            <span className="mt-5 inline-block text-sm text-slate-500">
              Coming in M6
            </span>
          </div>

          {/* Maintenance Reports */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-3xl">📊</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Maintenance Reports
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Review breakdown reports, root causes and corrective
              actions.
            </p>

            <span className="mt-5 inline-block text-sm text-slate-500">
              Planned
            </span>
          </div>

          {/* Preventive Maintenance */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-3xl">🗓️</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Preventive Maintenance
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Organize recurring maintenance tasks and schedules.
            </p>

            <span className="mt-5 inline-block text-sm text-slate-500">
              Planned
            </span>
          </div>

          {/* Spare Management */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-3xl">⚙️</div>

            <h3 className="mt-4 text-xl font-semibold text-white">
              Spare Management
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Track critical spare parts, stock and consumption.
            </p>

            <span className="mt-5 inline-block text-sm text-slate-500">
              Planned
            </span>
          </div>

        </section>
      </div>
    </main>
  );
}