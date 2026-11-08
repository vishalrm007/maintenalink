"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  title: string;
  description: string | null;
  job_type: string;
  required_skill_id: string | null;
  location: string | null;
  required_date: string | null;
  start_time: string | null;
  duration_hours: number | null;
  budget: number | null;
  urgency: string;
  status: string;
  created_at: string;
};

type Skill = {
  id: string;
  name: string;
};

type ApplicationCount = {
  job_id: string;
};

type EditForm = {
  title: string;
  description: string;
  job_type: string;
  required_skill_id: string;
  location: string;
  required_date: string;
  start_time: string;
  duration_hours: string;
  budget: string;
  urgency: string;
};

const emptyEditForm: EditForm = {
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
};

export default function CompanyJobsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [applicationCounts, setApplicationCounts] = useState<
    Record<string, number>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingJob, setUpdatingJob] = useState<string | null>(null);

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);

  useEffect(() => {
    loadJobs();
    loadSkills();
  }, []);

  async function loadSkills() {
    const { data, error } = await supabase
      .from("skills")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Skills loading error:", error);
      return;
    }

    setSkills((data || []) as Skill[]);
  }

  async function loadJobs() {
    setLoading(true);
    setError("");

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
        throw new Error("Company profile not found.");
      }

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select(
          "id, title, description, job_type, required_skill_id, location, required_date, start_time, duration_hours, budget, urgency, status, created_at"
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });

      if (jobError) {
        throw jobError;
      }

      const loadedJobs = (jobData || []) as Job[];
      setJobs(loadedJobs);

      if (loadedJobs.length > 0) {
        const jobIds = loadedJobs.map((job) => job.id);

        const { data: applicationData, error: applicationError } =
          await supabase
            .from("job_applications")
            .select("job_id")
            .in("job_id", jobIds);

        if (applicationError) {
          console.error("Application count error:", applicationError);
          setApplicationCounts({});
        } else {
          const counts: Record<string, number> = {};

          (applicationData as ApplicationCount[] || []).forEach(
            (application) => {
              counts[application.job_id] =
                (counts[application.job_id] || 0) + 1;
            }
          );

          setApplicationCounts(counts);
        }
      } else {
        setApplicationCounts({});
      }
    } catch (err) {
      console.error("My Jobs loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your jobs."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing(job: Job) {
    setEditingJobId(job.id);

    setEditForm({
      title: job.title,
      description: job.description || "",
      job_type: job.job_type,
      required_skill_id: job.required_skill_id || "",
      location: job.location || "",
      required_date: job.required_date || "",
      start_time: job.start_time?.slice(0, 5) || "",
      duration_hours:
        job.duration_hours !== null
          ? String(job.duration_hours)
          : "",
      budget: job.budget !== null ? String(job.budget) : "",
      urgency: job.urgency,
    });

    setError("");
  }

  function updateEditField(
    field: keyof EditForm,
    value: string
  ) {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function saveJobChanges(jobId: string) {
    if (!editForm.title.trim()) {
      setError("Please enter a job title.");
      return;
    }

    if (!editForm.location.trim()) {
      setError("Please enter the job location.");
      return;
    }

    const duration = editForm.duration_hours
      ? Number(editForm.duration_hours)
      : null;

    const budget = editForm.budget
      ? Number(editForm.budget)
      : null;

    if (
      duration !== null &&
      (!Number.isFinite(duration) || duration <= 0)
    ) {
      setError("Please enter a valid job duration.");
      return;
    }

    if (
      budget !== null &&
      (!Number.isFinite(budget) || budget < 0)
    ) {
      setError("Please enter a valid budget.");
      return;
    }

    setUpdatingJob(jobId);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          job_type: editForm.job_type,
          required_skill_id: editForm.required_skill_id || null,
          location: editForm.location.trim(),
          required_date: editForm.required_date || null,
          start_time: editForm.start_time || null,
          duration_hours: duration,
          budget,
          urgency: editForm.urgency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (updateError) {
        throw updateError;
      }

      setEditingJobId(null);
      setEditForm(emptyEditForm);

      await loadJobs();

      alert("Job details updated successfully!");
    } catch (err) {
      console.error("Job update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the job."
      );
    } finally {
      setUpdatingJob(null);
    }
  }

  async function closeJob(jobId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this job? Technicians will no longer see it as an open opportunity."
    );

    if (!confirmed) return;

    setUpdatingJob(jobId);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (updateError) {
        throw updateError;
      }

      await loadJobs();

      alert("Job cancelled successfully.");
    } catch (err) {
      console.error("Job cancellation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel this job."
      );
    } finally {
      setUpdatingJob(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Not specified";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(date: string) {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatLabel(value: string) {
    return value.replaceAll("_", " ").replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
  }

  function statusClass(status: string) {
    switch (status.toLowerCase()) {
      case "open":
        return "border-green-500/30 bg-green-500/10 text-green-400";
      case "cancelled":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      case "closed":
      case "completed":
        return "border-slate-600 bg-slate-700/40 text-slate-300";
      default:
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-center text-white">
        Loading your maintenance jobs...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
              Company Dashboard
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              My Maintenance Jobs
            </h1>

            <p className="mt-2 text-slate-400">
              Manage your maintenance requirements and track applications.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/company/dashboard"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>

            <Link
              href="/company/jobs/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
            >
              + Post New Job
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Jobs</p>
            <p className="mt-2 text-3xl font-bold">{jobs.length}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Open Jobs</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {jobs.filter((job) => job.status === "open").length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Applications</p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {Object.values(applicationCounts).reduce(
                (total, count) => total + count,
                0
              )}
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Your Posted Jobs</h2>

          <button
            onClick={loadJobs}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h3 className="text-lg font-semibold">
              No jobs posted yet
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Post your first maintenance requirement to find skilled technicians.
            </p>

            <Link
              href="/company/jobs/new"
              className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              Post Your First Job
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{job.title}</h3>

                    <p className="mt-2 text-sm text-slate-400">
                      {job.location || "Location not specified"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(job.status)}`}
                  >
                    {formatLabel(job.status)}
                  </span>
                </div>

                {job.description && (
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {job.description}
                  </p>
                )}

                <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Job Type</p>
                    <p className="mt-1 text-sm">
                      {formatLabel(job.job_type)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Required Date</p>
                    <p className="mt-1 text-sm">
                      {formatDate(job.required_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Budget</p>
                    <p className="mt-1 text-sm font-semibold text-green-400">
                      {job.budget !== null
                        ? `₹${Number(job.budget).toLocaleString("en-IN")}`
                        : "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Urgency</p>
                    <p className="mt-1 text-sm">
                      {formatLabel(job.urgency)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="mt-1 text-sm">
                      {job.duration_hours
                        ? `${job.duration_hours} hours`
                        : "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Applications Received
                    </p>
                    <p className="mt-1 text-sm font-semibold text-blue-400">
                      {applicationCounts[job.id] || 0}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Posted On</p>
                    <p className="mt-1 text-sm">
                      {formatDateTime(job.created_at)}
                    </p>
                  </div>
                </div>

                {editingJobId === job.id && (
                  <div className="mt-6 space-y-4 border-t border-slate-700 pt-5">
                    <h4 className="text-lg font-semibold text-blue-400">
                      Edit Job Details
                    </h4>

                    <div>
                      <label className="mb-1 block text-sm text-slate-300">
                        Job Title *
                      </label>
                      <input
                        value={editForm.title}
                        onChange={(e) =>
                          updateEditField("title", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-300">
                        Job Type *
                      </label>
                      <select
                        value={editForm.job_type}
                        onChange={(e) =>
                          updateEditField("job_type", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
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
                      <label className="mb-1 block text-sm text-slate-300">
                        Job Description
                      </label>
                      <textarea
                        rows={4}
                        value={editForm.description}
                        onChange={(e) =>
                          updateEditField("description", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-300">
                        Required Technical Skill
                      </label>
                      <select
                        value={editForm.required_skill_id}
                        onChange={(e) =>
                          updateEditField(
                            "required_skill_id",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                      >
                        <option value="">No specific skill</option>
                        {skills.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-300">
                        Job Location *
                      </label>
                      <input
                        value={editForm.location}
                        onChange={(e) =>
                          updateEditField("location", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-slate-300">
                          Required Date
                        </label>
                        <input
                          type="date"
                          value={editForm.required_date}
                          onChange={(e) =>
                            updateEditField("required_date", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-300">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={editForm.start_time}
                          onChange={(e) =>
                            updateEditField("start_time", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-300">
                          Estimated Duration (Hours)
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editForm.duration_hours}
                          onChange={(e) =>
                            updateEditField("duration_hours", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-300">
                          Estimated Budget (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editForm.budget}
                          onChange={(e) =>
                            updateEditField("budget", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-300">
                        Urgency *
                      </label>
                      <select
                        value={editForm.urgency}
                        onChange={(e) =>
                          updateEditField("urgency", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-700 pt-4">
                      <button
                        onClick={() => {
                          setEditingJobId(null);
                          setEditForm(emptyEditForm);
                          setError("");
                        }}
                        disabled={updatingJob === job.id}
                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        Discard Changes
                      </button>

                      <button
                        onClick={() => saveJobChanges(job.id)}
                        disabled={updatingJob === job.id}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                      >
                        {updatingJob === job.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}

                {job.status === "open" && editingJobId !== job.id && (
                  <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4">
                    <button
                      onClick={() => startEditing(job)}
                      className="rounded-lg border border-blue-500/40 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/10"
                    >
                      Edit Job
                    </button>
<Link
  href={`/company/jobs/${job.id}/applications`}
  className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 transition hover:bg-green-500/20"
>
  View Applications
</Link>
                    <button
                      onClick={() => closeJob(job.id)}
                      disabled={updatingJob === job.id}
                      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {updatingJob === job.id
                        ? "Cancelling..."
                        : "Cancel Job"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}