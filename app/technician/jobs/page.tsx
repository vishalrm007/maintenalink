"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  company_id: string;
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

type Company = {
  id: string;
  company_name: string;
  industry: string | null;
  city: string | null;
};

type Skill = {
  id: string;
  name: string;
  category: string | null;
};

type JobCard = Job & {
  company_name: string;
  company_industry: string | null;
  company_city: string | null;
  skill_name: string | null;
};

export default function TechnicianJobsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  // Application states
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [proposedRate, setProposedRate] = useState("");
  const [coverMessage, setCoverMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      setLoading(true);
      setError("");

      try {
        // 1. Check logged-in user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/login");
          return;
        }

        // 2. Verify technician role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role !== "technician") {
          router.replace("/login");
          return;
        }

        // 3. Fetch technician record
        const { data: technician, error: technicianError } = await supabase
          .from("technicians")
          .select("id")
          .eq("profile_id", user.id)
          .single();

        if (technicianError) throw technicianError;

        if (!technician) {
          throw new Error("Technician profile not found.");
        }

        if (!active) return;

        setTechnicianId(technician.id);

        // 4. Fetch existing applications
        const { data: applicationData, error: applicationError } =
          await supabase
            .from("job_applications")
            .select("job_id")
            .eq("technician_id", technician.id);

        if (applicationError) throw applicationError;

        if (!active) return;

        setAppliedJobIds(
          (applicationData || []).map((application) => application.job_id)
        );

        // 5. Fetch open jobs
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(`
            id,
            company_id,
            title,
            description,
            job_type,
            required_skill_id,
            location,
            required_date,
            start_time,
            duration_hours,
            budget,
            urgency,
            status,
            created_at
          `)
          .eq("status", "open")
          .order("created_at", { ascending: false });

        if (jobError) throw jobError;

        const jobList = (jobData || []) as Job[];

        if (!active) return;

        if (jobList.length === 0) {
          setJobs([]);
          return;
        }

        // 6. Fetch public company information
        const companyIds = [
          ...new Set(jobList.map((job) => job.company_id)),
        ];

        const { data: companyData, error: companyError } = await supabase
          .from("company_public_profiles")
          .select("id, company_name, industry, city")
          .in("id", companyIds);

        if (companyError) throw companyError;

        // 7. Fetch required skills
        const skillIds = [
          ...new Set(
            jobList
              .map((job) => job.required_skill_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];

        let skillData: Skill[] = [];

        if (skillIds.length > 0) {
          const { data, error: skillError } = await supabase
            .from("skills")
            .select("id, name, category")
            .in("id", skillIds);

          if (skillError) throw skillError;

          skillData = (data || []) as Skill[];
        }

        // 8. Combine job, company and skill information
        const companies = (companyData || []) as Company[];

        const companyMap = new Map(
          companies.map((company) => [company.id, company])
        );

        const skillMap = new Map(
          skillData.map((skill) => [skill.id, skill])
        );

        const formattedJobs: JobCard[] = jobList.map((job) => {
          const company = companyMap.get(job.company_id);

          const skill = job.required_skill_id
            ? skillMap.get(job.required_skill_id)
            : null;

          return {
            ...job,
            company_name: company?.company_name || "Company",
            company_industry: company?.industry || null,
            company_city: company?.city || null,
            skill_name: skill?.name || null,
          };
        });

        if (active) {
          setJobs(formattedJobs);
        }
      } catch (err) {
        console.error("Error loading jobs:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load maintenance jobs."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  // Open application form
  function openApplicationForm(job: JobCard) {
    setSelectedJob(job);
    setProposedRate("");
    setCoverMessage("");
    setApplicationMessage("");
  }

  // Close application form
  function closeApplicationForm() {
    if (applyingJobId) return;

    setSelectedJob(null);
    setProposedRate("");
    setCoverMessage("");
  }

  // Submit job application
  async function applyForJob() {
    if (!selectedJob || !technicianId) {
      setApplicationMessage("Technician profile not found.");
      return;
    }

    if (appliedJobIds.includes(selectedJob.id)) {
      setApplicationMessage("You have already applied for this job.");
      setSelectedJob(null);
      return;
    }

    const rate = Number(proposedRate);

    if (!proposedRate.trim() || !Number.isFinite(rate) || rate <= 0) {
      setApplicationMessage("Please enter a valid proposed rate.");
      return;
    }

    setApplyingJobId(selectedJob.id);
    setApplicationMessage("");

    try {
      const { error: insertError } = await supabase
        .from("job_applications")
        .insert({
          job_id: selectedJob.id,
          technician_id: technicianId,
          proposed_rate: rate,
          message: coverMessage.trim() || null,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          setAppliedJobIds((previous) =>
            previous.includes(selectedJob.id)
              ? previous
              : [...previous, selectedJob.id]
          );

          setApplicationMessage("You have already applied for this job.");
          setSelectedJob(null);
          return;
        }

        throw insertError;
      }

      setAppliedJobIds((previous) =>
        previous.includes(selectedJob.id)
          ? previous
          : [...previous, selectedJob.id]
      );

      setSelectedJob(null);
      setProposedRate("");
      setCoverMessage("");
      setApplicationMessage("Application submitted successfully!");
    } catch (err) {
      console.error("Job application error:", err);

      setApplicationMessage(
        err instanceof Error
          ? err.message
          : "Unable to submit your application."
      );
    } finally {
      setApplyingJobId(null);
    }
  }

  // Search and filters
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        !searchText ||
        job.title.toLowerCase().includes(searchText) ||
        (job.description || "").toLowerCase().includes(searchText) ||
        job.company_name.toLowerCase().includes(searchText) ||
        (job.skill_name || "").toLowerCase().includes(searchText) ||
        (job.location || "").toLowerCase().includes(searchText);

      const matchesLocation =
        !locationFilter ||
        (job.location || "")
          .toLowerCase()
          .includes(locationFilter.toLowerCase());

      const matchesUrgency =
        urgencyFilter === "all" ||
        job.urgency.toLowerCase() === urgencyFilter;

      return matchesSearch && matchesLocation && matchesUrgency;
    });
  }, [jobs, search, locationFilter, urgencyFilter]);

  function formatBudget(budget: number | null) {
    if (budget === null) return "Not specified";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(budget);
  }

  function formatDate(date: string | null) {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function urgencyStyle(urgency: string) {
    switch (urgency.toLowerCase()) {
      case "urgent":
        return "bg-red-500/15 text-red-400 border-red-500/30";

      case "high":
        return "bg-orange-500/15 text-orange-400 border-orange-500/30";

      default:
        return "bg-green-500/15 text-green-400 border-green-500/30";
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Maintenance Jobs</h1>
            <p className="mt-2 text-slate-400">
              Find maintenance opportunities matching your skills.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/technician/jobs/my"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
            >
              My Applications
            </Link>

            <Link
              href="/technician/dashboard"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search jobs, skills or companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <input
            type="text"
            placeholder="Filter by location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          >
            <option value="all">All Urgency Levels</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Application Message */}
        {applicationMessage && (
          <div className="mb-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-300">
            {applicationMessage}
          </div>
        )}

        {/* Job Count */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Available Opportunities</h2>

          {!loading && (
            <span className="text-sm text-slate-400">
              {filteredJobs.length} jobs found
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading maintenance jobs...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400">
            <p className="font-semibold">Unable to load jobs</p>
            <p className="mt-2 text-sm">{error}</p>

            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredJobs.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <h3 className="text-xl font-semibold">No jobs found</h3>

            <p className="mt-3 text-slate-400">
              {jobs.length === 0
                ? "There are currently no open maintenance jobs."
                : "Try changing your search or filter criteria."}
            </p>
          </div>
        )}

        {/* Job Cards */}
        {!loading && !error && filteredJobs.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
              >
                {/* Company */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-blue-400">
                    {job.company_name}
                  </p>

                  {job.company_industry && (
                    <p className="mt-1 text-xs text-slate-500">
                      {job.company_industry}
                    </p>
                  )}
                </div>

                {/* Title and Urgency */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold">{job.title}</h3>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${urgencyStyle(
                      job.urgency
                    )}`}
                  >
                    {job.urgency}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                  {job.description || "No job description provided."}
                </p>

                {/* Job Information */}
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-5">
                  <div>
                    <p className="text-xs text-slate-500">Job Type</p>
                    <p className="mt-1 capitalize text-sm text-slate-200">
                      {job.job_type.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Required Skill</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {job.skill_name || "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {job.location || job.company_city || "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Budget</p>
                    <p className="mt-1 text-sm font-semibold text-green-400">
                      {formatBudget(job.budget)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Required Date</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(job.required_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {job.duration_hours
                        ? `${job.duration_hours} hours`
                        : "Not specified"}
                    </p>
                  </div>
                </div>

                {/* Job Application */}
                <div className="mt-6">
                  {appliedJobIds.includes(job.id) ? (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-400"
                    >
                      ✓ Applied
                    </button>
                  ) : (
                    <button
                      onClick={() => openApplicationForm(job)}
                      disabled={!technicianId}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply for Job
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Form Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-400">
                  Job Application
                </p>

                <h2 className="mt-1 text-2xl font-bold text-white">
                  {selectedJob.title}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {selectedJob.company_name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeApplicationForm}
                disabled={applyingJobId !== null}
                className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs text-slate-500">Company Budget</p>
              <p className="mt-1 text-lg font-semibold text-green-400">
                {formatBudget(selectedJob.budget)}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyForJob();
              }}
              className="space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Your Proposed Rate (₹) *
                </label>

                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder="Enter your expected amount"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Enter the total amount you expect for completing this job.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Message to Company
                </label>

                <textarea
                  rows={4}
                  value={coverMessage}
                  onChange={(e) => setCoverMessage(e.target.value)}
                  placeholder="Briefly explain your experience and why you are suitable for this job..."
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Optional: Introduce yourself or explain your relevant experience.
                </p>
              </div>

              {applicationMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {applicationMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeApplicationForm}
                  disabled={applyingJobId !== null}
                  className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={applyingJobId !== null}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyingJobId
                    ? "Submitting Application..."
                    : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}