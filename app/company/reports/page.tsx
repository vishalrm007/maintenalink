"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { jsPDF } from "jspdf";

const supabase = createClient();

type JobReport = {
  id: string;
  job_id: string;
  technician_id: string;
  problem_description: string | null;
  diagnosis: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  spare_used: string | null;
  downtime_minutes: number | null;
  remarks: string | null;
  created_at: string;
  status: string;
  company_remarks: string | null;
  job?: {
    title: string;
    location: string | null;
    job_type: string;
  };
  technician_name?: string;
};
type JobRow = {
  id: string;
  title: string;
  location: string | null;
  job_type: string;
};

type TechnicianPublicProfile = {
  technician_id: string;
  full_name: string | null;
};

type JobReportRow = {
  id: string;
  job_id: string;
  technician_id: string;
  problem_description: string | null;
  diagnosis: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  spare_used: string | null;
  downtime_minutes: number | null;
  remarks: string | null;
  created_at: string;
  status: string;
  company_remarks: string | null;
};
export default function CompanyReportsPage() {
  const [reports, setReports] = useState<JobReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [companyRemarks, setCompanyRemarks] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please log in to view maintenance reports.");
      }

      // Get the logged-in company's record.
const { data: company, error: companyError } = await supabase
  .from("companies")
  .select("id")
  .eq("profile_id", user.id)
  .single();

if (companyError || !company) {
  throw new Error("Company profile could not be found.");
}

// Get jobs belonging to this company.
const { data: jobsRaw, error: jobsError } = await supabase
  .from("jobs")
  .select("id, title, location, job_type")
  .eq("company_id", company.id);

if (jobsError) throw jobsError;

const jobs = (jobsRaw || []) as JobRow[];

if (jobs.length === 0) {
  setReports([]);
  return;
}
      const jobIds = jobs.map((job) => job.id);

      // Get submitted reports for these jobs.
      const { data: reportData, error: reportsError } = await supabase
  .from("job_reports")
  .select("*")
  .in("job_id", jobIds)
  .in("status", ["submitted", "approved"])
  .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;

      if (!reportData || reportData.length === 0) {
        setReports([]);
        return;
      }

      // Get technician names.
      const technicianIds = [
        ...new Set(reportData.map((report) => report.technician_id)),
      ];

      const { data: technicianNames, error: namesError } = await supabase
        .from("technician_public_profiles")
        .select("technician_id, full_name")
        .in("technician_id", technicianIds);

      if (namesError) throw namesError;

      const formattedReports = reportData.map((report) => {
        const job = jobs.find((item) => item.id === report.job_id);

        const technician = technicianNames?.find(
          (item) => item.technician_id === report.technician_id
        );

        return {
          ...report,
          job: job
            ? {
                title: job.title,
                location: job.location,
                job_type: job.job_type,
              }
            : undefined,
          technician_name: technician?.full_name || "Technician",
        };
      });

      setReports(formattedReports);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      setError(err.message || "Unable to load maintenance reports.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewReport(
    reportId: string,
    decision: "approved" | "rejected"
  ) {
    const remarks = companyRemarks[reportId]?.trim() || null;

    if (decision === "rejected" && !remarks) {
      alert("Please enter remarks explaining what needs correction.");
      return;
    }

    const confirmation =
      decision === "approved"
        ? "Approve this service report and mark the job as completed?"
        : "Reject this report and request corrections from the technician?";

    if (!window.confirm(confirmation)) return;

    setProcessingId(reportId);
    setError("");

    try {
      const { data, error: reviewError } = await supabase.rpc(
        "company_review_job_report",
        {
          p_report_id: reportId,
          p_decision: decision,
          p_company_remarks: remarks,
        }
      );

      if (reviewError) throw reviewError;

      if (data && data.success === false) {
        throw new Error(data.message || "Report review failed.");
      }
if (decision === "approved") {
  const approvedReport = reports.find(
    (report) => report.id === reportId
  );

  if (approvedReport) {
    downloadReportPDF({
      ...approvedReport,
      status: "approved",
      company_remarks: remarks,
    });
  }
}
      alert(
        decision === "approved"
          ? "Report approved. Job marked as completed."
          : "Report rejected. Technician can review the remarks."
      );

      await fetchReports();
    } catch (err: any) {
      console.error("Report review error:", err);
      setError(err.message || "Unable to process report.");
    } finally {
      setProcessingId(null);
    }
  }
function downloadReportPDF(report: JobReport) {
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const left = 20;
  const right = pageWidth - 20;
  let y = 25;

  function addSection(title: string, content: string | number | null | undefined) {
    if (y > pageHeight - 35) {
      pdf.addPage();
      y = 25;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(30, 100, 200);
    pdf.text(title, left, y);
    y += 7;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);

    const value = String(content ?? "Not provided");
    const lines = pdf.splitTextToSize(value, pageWidth - 40);

    if (y + lines.length * 6 > pageHeight - 20) {
      pdf.addPage();
      y = 25;
    }

    pdf.text(lines, left, y);
    y += lines.length * 6 + 7;
  }

  // Header
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 38, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("MaintenaLink", left, 17);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("MAINTENANCE SERVICE REPORT", left, 27);

  y = 50;

  addSection("Job Title", report.job?.title);
  addSection("Location", report.job?.location);
  addSection("Job Type", report.job?.job_type);
  addSection("Technician", report.technician_name);
  addSection("Report Date", new Date(report.created_at).toLocaleString());

  addSection("Problem Description", report.problem_description);
  addSection("Diagnosis", report.diagnosis);
  addSection("Root Cause", report.root_cause);
  addSection("Corrective Action", report.corrective_action);
  addSection("Spare Parts Used", report.spare_used);
  addSection("Downtime", `${report.downtime_minutes ?? 0} minutes`);
  addSection("Technician Remarks", report.remarks);
  addSection("Company Review Remarks", report.company_remarks);
  addSection("Approval Status", "APPROVED");

  // Footer
  const pageCount = pdf.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `Generated by MaintenaLink | Page ${i} of ${pageCount}`,
      left,
      pageHeight - 10
    );
  }

  const filename = `MaintenaLink-Service-Report-${report.id.slice(0, 8)}.pdf`;

  pdf.save(filename);
}
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/company/dashboard"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold">
              Maintenance Reports
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Review technician-submitted reports and approve completed work.
            </p>
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh Reports
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            Loading maintenance reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-10 text-center">
            <div className="text-4xl">📋</div>

            <h2 className="mt-4 text-xl font-semibold">
              No Pending Reports
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Technician-submitted maintenance reports will appear here
              for your review.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-6"
              >
                {/* Report Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {report.job?.title || "Maintenance Job"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      Technician: {report.technician_name}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {report.job?.location || "Location not specified"}
                      {" • "}
                      {report.job?.job_type || "Maintenance"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Submitted:{" "}
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-1 text-xs font-semibold text-yellow-400">
                    Pending Review
                  </span>
                </div>

                <div className="my-5 border-t border-slate-700" />

                {/* Report Details */}
                <div className="grid gap-5 md:grid-cols-2">

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Problem Description
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.problem_description || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Diagnosis
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.diagnosis || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Root Cause
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.root_cause || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Corrective Action
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.corrective_action || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Spare Parts Used
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.spare_used || "None specified"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-blue-400">
                      Downtime
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.downtime_minutes ?? 0} minutes
                    </p>
                  </div>

                </div>

                {report.remarks && (
                  <div className="mt-5 rounded-lg bg-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-blue-400">
                      Technician Remarks
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {report.remarks}
                    </p>
                  </div>
                )}

                {/* Company Review Remarks */}
                <div className="mt-6">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Review Remarks
                  </label>

                  <textarea
                    value={companyRemarks[report.id] || ""}
                    onChange={(e) =>
                      setCompanyRemarks((previous) => ({
                        ...previous,
                        [report.id]: e.target.value,
                      }))
                    }
                    placeholder="Enter feedback or correction instructions..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      reviewReport(report.id, "approved")
                    }
                    disabled={processingId === report.id}
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {processingId === report.id
                      ? "Processing..."
                      : "Approve Report"}
                  </button>

                  <button
                    onClick={() =>
                      reviewReport(report.id, "rejected")
                    }
                    disabled={processingId === report.id}
                    className="rounded-lg border border-red-700 bg-red-950/40 px-5 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
                  >
                    Request Corrections
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}