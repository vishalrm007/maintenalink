"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompanyProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [industrialArea, setIndustrialArea] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [machineCount, setMachineCount] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    // Confirm that this user is a company
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "company") {
      setMessage("This page is only available to company accounts.");
      setLoading(false);
      return;
    }

    // Load existing company profile if available
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (company) {
      setCompanyName(company.company_name || "");
      setIndustry(company.industry || "");
      setGstin(company.gstin || "");
      setAddress(company.address || "");
      setCity(company.city || "");
      setIndustrialArea(company.industrial_area || "");
      setEmployeeCount(
        company.employee_count !== null
          ? String(company.employee_count)
          : ""
      );
      setMachineCount(
        company.machine_count !== null
          ? String(company.machine_count)
          : ""
      );
    }

    setLoading(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("companies")
      .upsert(
        {
          profile_id: user.id,
          company_name: companyName,
          industry: industry || null,
          gstin: gstin || null,
          address: address || null,
          city: city || null,
          industrial_area: industrialArea || null,
          employee_count: employeeCount
            ? Number(employeeCount)
            : null,
          machine_count: machineCount
            ? Number(machineCount)
            : null,
        },
        {
          onConflict: "profile_id",
        }
      );

    if (error) {
      console.error(error);
      setMessage(`Error saving profile: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Company profile saved successfully.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Company Profile
          </h1>

          <p className="mt-2 text-slate-400">
            Tell technicians about your company and maintenance requirements.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Company Name *
            </label>

            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full rounded-lg bg-slate-800 p-3 outline-none"
              placeholder="ABC Manufacturing Pvt Ltd"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Industry
            </label>

            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-lg bg-slate-800 p-3 outline-none"
              placeholder="Automotive / Plastic / Packaging"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              GSTIN
            </label>

            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-slate-800 p-3 uppercase outline-none"
              placeholder="27XXXXXXXXXXXXXXX"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Address
            </label>

            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-800 p-3 outline-none"
              placeholder="Factory address"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                City
              </label>

              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg bg-slate-800 p-3 outline-none"
                placeholder="Pune"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Industrial Area
              </label>

              <input
                type="text"
                value={industrialArea}
                onChange={(e) =>
                  setIndustrialArea(e.target.value)
                }
                className="w-full rounded-lg bg-slate-800 p-3 outline-none"
                placeholder="Chakan MIDC"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Number of Employees
              </label>

              <input
                type="number"
                min="0"
                value={employeeCount}
                onChange={(e) =>
                  setEmployeeCount(e.target.value)
                }
                className="w-full rounded-lg bg-slate-800 p-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Number of Machines
              </label>

              <input
                type="number"
                min="0"
                value={machineCount}
                onChange={(e) =>
                  setMachineCount(e.target.value)
                }
                className="w-full rounded-lg bg-slate-800 p-3 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-white p-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Company Profile"}
          </button>

          {message && (
            <div className="rounded-lg bg-slate-800 p-4 text-sm">
              {message}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}