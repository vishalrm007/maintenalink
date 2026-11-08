"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Skill = {
  id: string;
  name: string;
};

export default function NewJobPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    job_type: "breakdown",
    required_skill_id: "",
    location: "",
    required_date: "",
    start_time: "",
    duration_hours: "",
    budget: "",
    urgency: "normal",
  });

  useEffect(() => {
    async function loadPage() {
      try {
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
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError || profile?.role !== "company") {
          router.replace("/login");
          return;
        }

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .eq("profile_id", user.id)
          .single();

        if (companyError || !company) {
          setError("Company profile not found. Please complete your company profile.");
          setLoading(false);
          return;
        }

        setCompanyId(company.id);

        const { data: skillData, error: skillError } = await supabase
          .from("skills")
          .select("id, name")
          .order("name");

        if (skillError) {
          throw skillError;
        }

        setSkills(skillData || []);
      } catch (err) {
        console.error("Page loading error:", err);
        setError("Unable to load the job posting form. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [router]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!companyId) {
      setError("Company information is missing.");
      return;
    }

    if (!form.title.trim() || !form.location.trim()) {
      setError("Please enter the job title and location.");
      return;
    }

    if (form.budget && Number(form.budget) < 0) {
      setError("Budget cannot be negative.");
      return;
    }

    if (form.duration_hours && Number(form.duration_hours) <= 0) {
      setError("Duration must be greater than zero.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: insertError } = await supabase
        .from("jobs")
        .insert({
          company_id: companyId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          job_type: form.job_type,
          required_skill_id: form.required_skill_id || null,
          location: form.location.trim(),
          required_date: form.required_date || null,
          start_time: form.start_time || null,
          duration_hours: form.duration_hours
            ? Number(form.duration_hours)
            : null,
          budget: form.budget ? Number(form.budget) : null,
          urgency: form.urgency,
          status: "open",
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      alert("Maintenance job posted successfully!");

      router.push("/company/dashboard");
    } catch (err) {
      console.error("Job creation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to post the job. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500";

  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-10 text-center text-white">
        Loading job posting form...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/company/dashboard"
          className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
            Company Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Post a Maintenance Job
          </h1>

          <p className="mt-3 text-slate-400">
            Share your maintenance requirement and connect with skilled
            technicians.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6"
        >
          <div>
            <label className={labelClass}>Job Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Example: Siemens PLC Breakdown Support"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Job Type *</label>
            <select
              name="job_type"
              value={form.job_type}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="breakdown">Breakdown Maintenance</option>
              <option value="preventive_maintenance">
                Preventive Maintenance
              </option>
              <option value="installation">Installation</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Job Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe the maintenance requirement, machine details and work expected..."
              rows={5}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Required Technical Skill</label>
            <select
              name="required_skill_id"
              value={form.required_skill_id}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select a skill (optional)</option>

              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Job Location *</label>
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Example: Chakan MIDC, Pune"
              className={inputClass}
              required
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Required Date</label>
              <input
                type="date"
                name="required_date"
                value={form.required_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Estimated Duration (Hours)</label>
              <input
                type="number"
                name="duration_hours"
                value={form.duration_hours}
                onChange={handleChange}
                min="0.5"
                step="0.5"
                placeholder="Example: 4"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estimated Budget (₹)</label>
              <input
                type="number"
                name="budget"
                value={form.budget}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="Example: 2500"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Urgency *</label>
            <select
              name="urgency"
              value={form.urgency}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Posting Job..." : "Post Maintenance Job"}
            </button>

            <Link
              href="/company/dashboard"
              className="rounded-lg border border-slate-700 px-6 py-3 text-center font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}