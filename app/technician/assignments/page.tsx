"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Assignment = {
  id: string;
  job_id: string;
  technician_id: string;
  agreed_amount: number | null;
  start_time: string | null;
  end_time: string | null;
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
  duration_hours: number | null;
};

type Company = {
  id: string;
  company_name: string;
  industry: string | null;
  city: string | null;
};

type AssignmentCard = Assignment & {
  job_title: string;
  job_description: string | null;
  job_type: string;
  job_location: string | null;
  required_date: string | null;
  duration_hours: number | null;
  company_name: string;
  company_industry: string | null;
  company_city: string | null;
  report_status: string | null;
};

export default function MyAssignmentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [assignments, setAssignments] = useState<AssignmentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingAssignmentId, setStartingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAssignments() {
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
        const { data: technician, error: technicianError } =
          await supabase
            .from("technicians")
            .select("id")
            .eq("profile_id", user.id)
            .single();

        if (technicianError) throw technicianError;

        if (!technician) {
          throw new Error("Technician profile not found.");
        }

        // 4. Fetch technician assignments
        const { data: assignmentData, error: assignmentError } =
          await supabase
            .from("job_assignments")
            .select(
              "id, job_id, technician_id, agreed_amount, start_time, end_time, status, created_at"
            )
            .eq("technician_id", technician.id)
            .order("created_at", { ascending: false });

        if (assignmentError) throw assignmentError;

        const assignmentList = (assignmentData || []) as Assignment[];

        if (!active) return;

        if (assignmentList.length === 0) {
          setAssignments([]);
          return;
        }
// 5. Fetch related jobs
        const jobIds = [
          ...new Set(assignmentList.map((item) => item.job_id)),
        ];

// 6. Fetch service report statuses
const { data: reportData, error: reportError } = await supabase
  .from("job_reports")
  .select("job_id, status")
  .in("job_id", jobIds);

if (reportError) throw reportError;

const reportMap = new Map(
  (reportData || []).map((report) => [
    report.job_id,
    report.status,
  ])
);
        

        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(
            "id, company_id, title, description, job_type, location, required_date, duration_hours"
          )
          .in("id", jobIds);

        if (jobError) throw jobError;

        const jobList = (jobData || []) as Job[];

        // 6. Fetch public company details
        const companyIds = [
          ...new Set(jobList.map((job) => job.company_id)),
        ];

        let companyList: Company[] = [];

        if (companyIds.length > 0) {
          const { data: companyData, error: companyError } =
            await supabase
              .from("company_public_profiles")
              .select("id, company_name, industry, city")
              .in("id", companyIds);

          if (companyError) throw companyError;

          companyList = (companyData || []) as Company[];
        }

        // 7. Combine assignment, job and company details
        const jobMap = new Map(
          jobList.map((job) => [job.id, job])
        );

        const companyMap = new Map(
          companyList.map((company) => [company.id, company])
        );

        const formattedAssignments: AssignmentCard[] =
          assignmentList.map((assignment) => {
            const job = jobMap.get(assignment.job_id);

            const company = job
              ? companyMap.get(job.company_id)
              : undefined;

            return {
              ...assignment,
              report_status: reportMap.get(assignment.job_id) || null,

              job_title: job?.title || "Job details unavailable",
              job_description: job?.description || null,
              job_type: job?.job_type || "Not specified",
              job_location: job?.location || null,
              required_date: job?.required_date || null,
              duration_hours: job?.duration_hours ?? null,

              company_name: company?.company_name || "Company",
              company_industry: company?.industry || null,
              company_city: company?.city || null,
            };
          });

        if (active) {
          setAssignments(formattedAssignments);
        }
      } catch (err) {
        console.error("Error loading assignments:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your assignments."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAssignments();

    return () => {
      active = false;
    };
  }, [router]);
async function handleStartJob(assignmentId: string) {
  const confirmed = window.confirm(
    "Are you sure you want to start this maintenance job?"
  );

  if (!confirmed) return;

  setStartingAssignmentId(assignmentId);

  try {
    const { data, error } = await supabase.rpc(
      "technician_start_assignment",
      {
        p_assignment_id: assignmentId,
      }
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error("Unable to start this job.");
    }

    setAssignments((previous) =>
      previous.map((item) =>
        item.id === assignmentId
          ? {
              ...item,
              status: "in_progress",
              start_time: new Date().toISOString(),
            }
          : item
      )
    );

    alert("Job started successfully!");

  } catch (err) {
    console.error("Error starting job:", err);

    alert(
      err instanceof Error
        ? err.message
        : "Unable to start the job."
    );

  } finally {
    setStartingAssignmentId(null);
  }
} 
function handleSubmitServiceReport(assignmentId: string) {
  window.location.href = `/technician/assignments/${assignmentId}/report`;
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
    if (!date) return "Not scheduled";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(date: string | null) {
    if (!date) return "Not scheduled";

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function statusStyle(status: string) {
    switch (status.toLowerCase()) {
      case "completed":
        return "border-green-500/30 bg-green-500/10 text-green-400";

      case "in_progress":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";

      case "cancelled":
        return "border-red-500/30 bg-red-500/10 text-red-400";

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
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
              Technician Dashboard
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              My Assignments
            </h1>

            <p className="mt-2 text-slate-400">
              Manage your assigned maintenance jobs and track their progress.
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

        {/* Summary */}
        {!loading && !error && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Total Assignments
              </p>

              <p className="mt-2 text-3xl font-bold">
                {assignments.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Active Jobs
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-400">
                {
                  assignments.filter(
                    (item) =>
                      ["assigned", "in_progress"].includes(
                        item.status.toLowerCase()
                      )
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">
                Completed Jobs
              </p>

              <p className="mt-2 text-3xl font-bold text-green-400">
                {
                  assignments.filter(
                    (item) =>
                      item.status.toLowerCase() === "completed"
                  ).length
                }
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading your assignments...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400">
            <p className="font-semibold">
              Unable to load assignments
            </p>

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
        {!loading && !error && assignments.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <h2 className="text-xl font-semibold">
              No assignments yet
            </h2>

            <p className="mt-3 text-slate-400">
              Jobs accepted by companies will appear here.
            </p>

            <Link
              href="/technician/jobs"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Browse Available Jobs
            </Link>
          </div>
        )}

        {/* Assignment Cards */}
        {!loading && !error && assignments.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
              >
                {/* Company */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-blue-400">
                    {assignment.company_name}
                  </p>

                  {assignment.company_industry && (
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.company_industry}
                    </p>
                  )}
                </div>

                {/* Job Title and Status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    {assignment.job_title}
                  </h2>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                      assignment.status
                    )}`}
                  >
                    {assignment.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {assignment.job_description ||
                    "No job description provided."}
                </p>

                {/* Job Details */}
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-5">
                  <div>
                    <p className="text-xs text-slate-500">
                      Job Type
                    </p>

                    <p className="mt-1 text-sm capitalize text-slate-200">
                      {assignment.job_type.replace(/_/g, " ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Location
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {assignment.job_location ||
                        assignment.company_city ||
                        "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Agreed Amount
                    </p>

                    <p className="mt-1 text-sm font-semibold text-green-400">
                      {formatAmount(assignment.agreed_amount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Required Date
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(assignment.required_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Scheduled Start
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {formatDateTime(assignment.start_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Scheduled End
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {formatDateTime(assignment.end_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Expected Duration
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {assignment.duration_hours !== null
                        ? `${assignment.duration_hours} hours`
                        : "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Assigned On
                    </p>

                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(assignment.created_at)}
                    </p>
                  </div>
                </div>

                {/* Job Execution */}
<div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
  <p className="text-sm font-medium text-blue-300">
    Job Execution
  </p>

  {assignment.status.toLowerCase() === "assigned" && (
    <>
      <p className="mt-1 text-xs text-slate-400">
        You have been selected for this job. Start the maintenance work when you are ready.
      </p>

      <button
        onClick={() => handleStartJob(assignment.id)}
        disabled={startingAssignmentId === assignment.id}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {startingAssignmentId === assignment.id
          ? "Starting Job..."
          : "▶ Start Job"}
      </button>
    </>
  )}

  {assignment.status.toLowerCase() === "in_progress" && (
  <div>
    <p className="mt-1 text-sm font-medium text-blue-300">
      Your job is currently in progress.
    </p>

    <p className="mt-2 text-xs text-slate-400">
      Started: {formatDateTime(assignment.start_time)}
    </p>

    {assignment.report_status?.toLowerCase() === "submitted" ? (
      <div className="mt-5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <p className="font-semibold text-yellow-400">
          ✓ Service Report Submitted
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Your report is awaiting company approval. You don't need to submit it again.
        </p>
      </div>
    ) : assignment.report_status?.toLowerCase() === "approved" ? (
      <div className="mt-5 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <p className="font-semibold text-green-400">
          ✓ Service Report Approved
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Your company has approved the service report.
        </p>
      </div>
    ) : (
      <>
        {assignment.report_status?.toLowerCase() === "rejected" && (
          <p className="mt-4 text-sm text-red-400">
            Corrections requested by the company. Please update and resubmit your report.
          </p>
        )}

        <button
          onClick={() => handleSubmitServiceReport(assignment.id)}
          className="mt-5 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500"
        >
          {assignment.report_status?.toLowerCase() === "rejected"
            ? "Resubmit Service Report →"
            : "Submit Service Report →"}
        </button>
      </>
    )}
  </div>
)}

  {assignment.status.toLowerCase() === "completed" && (
    <p className="mt-2 text-sm text-green-400">
      ✓ This maintenance job has been completed.
    </p>
  )}
</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}