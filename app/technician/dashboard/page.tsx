"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TechnicianDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Technician");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [completedFields, setCompletedFields] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // Get user profile and verify role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error("Profile loading error:", profileError);
        return;
      }

      if (profile.role !== "technician") {
        router.replace("/company/dashboard");
        return;
      }

      setUserName(profile.full_name || user.email || "Technician");

      // Get technician information
      const { data: technician, error: technicianError } = await supabase
        .from("technicians")
        .select(
          "id,city, industrial_area, years_experience, about, hourly_rate"
        )
        .eq("profile_id", user.id)
        .maybeSingle();

      if (technicianError) {
        console.error("Technician data error:", technicianError);
        return;
      }

      if (!technician) {
        setProfileCompletion(0);
        setCompletedFields(0);
        return;
      }

      // Get technician's selected skills
      const { data: technicianSkills, error: skillsError } = await supabase
        .from("technician_skills")
        .select("skill_id")
        .eq("technician_id", technician.id);

      if (skillsError) {
        console.error("Technician skills error:", skillsError);
        return;
      }

      // Calculate completed profile fields
      const checks = [
        Boolean(technician.city?.trim()),
        Boolean(technician.industrial_area?.trim()),
        Number(technician.years_experience) > 0,
        Boolean(technician.about?.trim()),
        Number(technician.hourly_rate) > 0,
        (technicianSkills?.length || 0) > 0,
      ];

      const completed = checks.filter(Boolean).length;
      const percentage = Math.round((completed / checks.length) * 100);

      setCompletedFields(completed);
      setProfileCompletion(percentage);

    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">MaintenaLink</h1>
            <p className="text-xs text-slate-400">
              Maintenance Technician Platform
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* WELCOME */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold">
            Welcome, {userName}
          </h2>

          <p className="mt-2 text-slate-400">
            Find maintenance jobs and manage your technician profile.
          </p>
        </div>

        {/* STATISTICS */}
        <div className="grid gap-5 md:grid-cols-4">

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Profile Completion
            </p>

            <p className="mt-2 text-3xl font-bold">
              {profileCompletion}%
            </p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-400">
              {completedFields} of 6 sections completed
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Available Jobs
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Active Jobs
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Jobs Completed
            </p>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>

        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-10">

          <h3 className="mb-5 text-xl font-semibold">
            Quick Actions
          </h3>

          <div className="grid gap-5 md:grid-cols-3">

            <Link
              href="/technician/profile"
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="mb-4 text-3xl">👤</div>
              <h4 className="text-lg font-semibold">My Profile</h4>
              <p className="mt-2 text-sm text-slate-400">
                Update your experience, location, skills and availability.
              </p>
            </Link>

            <Link
              href="/technician/jobs"
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="mb-4 text-3xl">🔧</div>
              <h4 className="text-lg font-semibold">
                Find Maintenance Jobs
              </h4>
              <p className="mt-2 text-sm text-slate-400">
                Search for maintenance requirements posted by companies.
              </p>
            </Link>

            <Link
              href="/technician/jobs/my"
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="mb-4 text-3xl">📋</div>
              <h4 className="text-lg font-semibold">My Jobs</h4>
              <p className="mt-2 text-sm text-slate-400">
                View your applications and assigned maintenance jobs.
              </p>
            </Link>

          </div>
        </div>

        {/* PROFILE COMPLETION MESSAGE */}
        {profileCompletion < 100 && (
          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold">
              Complete Your Technician Profile
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Your profile is {profileCompletion}% complete.
              Add the remaining information to improve your visibility
              to companies.
            </p>

            <Link
              href="/technician/profile"
              className="mt-5 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {profileCompletion === 100 && (
          <div className="mt-10 rounded-xl border border-green-800 bg-green-950 p-6">
            <h3 className="text-lg font-semibold text-green-400">
              Your Technician Profile Is Complete!
            </h3>

            <p className="mt-2 text-sm text-green-200">
              Companies can discover your professional profile.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}