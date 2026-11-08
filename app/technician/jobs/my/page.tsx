"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Application = {
  id: string;
  job_id: string;
  technician_id: string;
  proposed_rate: number | null;
  message: string | null;
  status: string;
  created_at: string;
};

type Job = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  job_type: string;
  location: string | null;
  required_date: string | null;
  budget: number | null;
};

type Company = {
  id: string;
  company_name: string;
  industry: string | null;
  city: string | null;
};

type ApplicationCard = Application & {
  job_title: string;
  job_description: string | null;
  job_type: string;
  job_location: string | null;
  required_date: string | null;
  company_name: string;
  company_industry: string | null;
  company_city: string | null;
  job_budget: number | null;
};

export default function MyApplicationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [applications, setApplications] = useState<ApplicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadApplications() {
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

        // 3. Get technician record
        const { data: technician, error: technicianError } = await supabase
          .from("technicians")
          .select("id")
          .eq("profile_id", user.id)
          .single();

        if (technicianError) throw technicianError;

        if (!technician) {
          throw new Error("Technician profile not found.");
        }

        // 4. Fetch technician applications
        const { data: applicationData, error: applicationError } =
          await supabase
            .from("job_applications")
            .select(
              "id, job_id, technician_id, proposed_rate, message, status, created_at"
            )
            .eq("technician_id", technician.id)
            .order("created_at", { ascending: false });

        if (applicationError) throw applicationError;

        const applicationList = (applicationData || []) as Application[];

        if (!active) return;

        if (applicationList.length === 0) {
          setApplications([]);
          return;
        }

        // 5. Fetch related jobs
        const jobIds = [
          ...new Set(applicationList.map((application) => application.job_id)),
        ];

        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(
            "id, company_id, title, description, job_type, location, required_date, budget"
          )
          .in("id", jobIds);

        if (jobError) throw jobError;

        const jobList = (jobData || []) as Job[];

        // 6. Fetch public company information
        const companyIds = [
          ...new Set(jobList.map((job) => job.company_id)),
        ];

        let companyList: Company[] = [];

        if (companyIds.length > 0) {
          const { data: companyData, error: companyError } = await supabase
            .from("company_public_profiles")
            .select("id, company_name, industry, city")
            .in("id", companyIds);

          if (companyError) throw companyError;

          companyList = (companyData || []) as Company[];
        }

        // 7. Combine application, job and company information
        const jobMap = new Map(jobList.map((job) => [job.id, job]));

        const companyMap = new Map(
          companyList.map((company) => [company.id, company])
        );

        const formattedApplications: ApplicationCard[] = applicationList.map(
          (application) => {
            const job = jobMap.get(application.job_id);
            const company = job
              ? companyMap.get(job.company_id)
              : undefined;

            return {
              ...application,
              job_title: job?.title || "Job details unavailable",
              job_description: job?.description || null,
              job_type: job?.job_type || "Not specified",
              job_location: job?.location || null,
              required_date: job?.required_date || null,
              company_name: company?.company_name || "Company",
              company_industry: company?.industry || null,
              company_city: company?.city || null,
              job_budget: job?.budget ?? null,
            };
          }
        );

        if (active) {
          setApplications(formattedApplications);
        }
      } catch (err) {
        console.error("Error loading applications:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your applications."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadApplications();

    return () => {
      active = false;
    };
  }, [router]);
async function withdrawApplication(applicationId: string) {
  const confirmed = window.confirm(
    "Are you sure you want to withdraw this application?"
  );

  if (!confirmed) return;

  setWithdrawingId(applicationId);
  setActionMessage("");
  setError("");

  try {
    const { error: updateError } = await supabase
      .from("job_applications")
      .update({ status: "withdrawn" })
      .eq("id", applicationId)
      .eq("status", "pending");

    if (updateError) throw updateError;

    setApplications((previous) =>
      previous.map((application) =>
        application.id === applicationId
          ? { ...application, status: "withdrawn" }
          : application
      )
    );

    setActionMessage("Your application has been withdrawn successfully.");
  } catch (err) {
    console.error("Application withdrawal error:", err);

    setActionMessage(
      err instanceof Error
        ? err.message
        : "Unable to withdraw your application."
    );
  } finally {
    setWithdrawingId(null);
  }
}
  function formatAmount(amount: number | null) {
    if (amount === null) return "Not specified";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(date: string | null) {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "accepted":
      return "border-green-500/30 bg-green-500/10 text-green-400";

    case "rejected":
      return "border-red-500/30 bg-red-500/10 text-red-400";

    case "withdrawn":
      return "border-slate-500/30 bg-slate-500/10 text-slate-400";

    default:
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }
}

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Applications</h1>
            <p className="mt-2 text-slate-400">
              Track the status of your maintenance job applications.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/technician/jobs"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
            >
              Browse Jobs
            </Link>

            <Link
              href="/technician/dashboard"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Summary */}
        {!loading && !error && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Total Applications</p>
              <p className="mt-2 text-3xl font-bold">
                {applications.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pending</p>
              <p className="mt-2 text-3xl font-bold text-yellow-400">
                {
                  applications.filter(
                    (application) =>
                      application.status.toLowerCase() === "pending"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Accepted</p>
              <p className="mt-2 text-3xl font-bold text-green-400">
                {
                  applications.filter(
                    (application) =>
                      application.status.toLowerCase() === "accepted"
                  ).length
                }
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading your applications...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400">
            <p className="font-semibold">Unable to load applications</p>
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
        {!loading && !error && applications.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <h2 className="text-xl font-semibold">No applications yet</h2>

            <p className="mt-3 text-slate-400">
              You haven't applied for any maintenance jobs yet.
            </p>

            <Link
              href="/technician/jobs"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Browse Available Jobs
            </Link>
          </div>
        )}
{actionMessage && (
  <div className="mb-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-300">
    {actionMessage}
  </div>
)}
        {/* Application Cards */}
        {!loading && !error && applications.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            {applications.map((application) => (
              <div
                key={application.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
              >
                {/* Company */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-blue-400">
                    {application.company_name}
                  </p>

                  {application.company_industry && (
                    <p className="mt-1 text-xs text-slate-500">
                      {application.company_industry}
                    </p>
                  )}
                </div>

                {/* Job Title and Status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    {application.job_title}
                  </h2>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                      application.status
                    )}`}
                  >
                    {application.status}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {application.job_description ||
                    "No job description provided."}
                </p>

                {/* Job Details */}
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-5">
                  <div>
                    <p className="text-xs text-slate-500">Job Type</p>
                    <p className="mt-1 text-sm capitalize text-slate-200">
                      {application.job_type.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {application.job_location ||
                        application.company_city ||
                        "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Company Budget</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {formatAmount(application.job_budget)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Your Proposed Rate</p>
                    <p className="mt-1 text-sm font-semibold text-green-400">
                      {formatAmount(application.proposed_rate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Required Date</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(application.required_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Applied On</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(application.created_at)}
                    </p>
                  </div>
                </div>
{/* Withdraw Application */}
{application.status.toLowerCase() === "pending" && (
  <div className="mt-5">
    <button
      onClick={() => withdrawApplication(application.id)}
      disabled={withdrawingId === application.id}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {withdrawingId === application.id
        ? "Withdrawing..."
        : "Withdraw Application"}
    </button>
  </div>
)}
                {/* Message */}
                <div className="mt-5 border-t border-slate-800 pt-5">
                  <p className="text-xs text-slate-500">
                    Your Message to Company
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {application.message || "No message provided."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}