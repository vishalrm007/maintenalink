"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SubmitServiceReportPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const assignmentId = params.assignmentId as string;

  const [form, setForm] = useState({
    problem_description: "",
    diagnosis: "",
    root_cause: "",
    corrective_action: "",
    spare_used: "",
    downtime_minutes: "",
    remarks: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!form.problem_description.trim()) {
      setErrorMessage("Please enter the problem description.");
      return;
    }

    if (!form.corrective_action.trim()) {
      setErrorMessage("Please enter the corrective action taken.");
      return;
    }

    const downtime =
      form.downtime_minutes.trim() === ""
        ? null
        : Number(form.downtime_minutes);

    if (
      downtime !== null &&
      (!Number.isInteger(downtime) || downtime < 0)
    ) {
      setErrorMessage("Downtime must be a valid non-negative whole number.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc(
        "technician_submit_service_report",
        {
          p_assignment_id: assignmentId,
          p_problem_description: form.problem_description.trim(),
          p_diagnosis: form.diagnosis.trim() || null,
          p_root_cause: form.root_cause.trim() || null,
          p_corrective_action: form.corrective_action.trim(),
          p_spare_used: form.spare_used.trim() || null,
          p_downtime_minutes: downtime,
          p_remarks: form.remarks.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to submit the service report."
        );
      }

      setSuccessMessage(
        "Service report submitted successfully. It is now awaiting company approval."
      );

      setTimeout(() => {
        router.push("/technician/assignments");
        router.refresh();
      }, 1800);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting the report.";

      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500";

  const labelClass = "mb-2 block text-sm font-medium text-slate-300";

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/technician/assignments")}
          className="mb-6 text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to My Assignments
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Submit Service Report</h1>
          <p className="mt-2 text-sm text-slate-400">
            Record the maintenance work performed and submit it for company
            approval.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6"
        >
          <div>
            <label className={labelClass}>
              Problem Description *
            </label>
            <textarea
              name="problem_description"
              value={form.problem_description}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              placeholder="Describe the reported machine problem..."
              required
            />
          </div>

          <div>
            <label className={labelClass}>Diagnosis</label>
            <textarea
              name="diagnosis"
              value={form.diagnosis}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              placeholder="Describe your technical diagnosis..."
            />
          </div>

          <div>
            <label className={labelClass}>Root Cause</label>
            <textarea
              name="root_cause"
              value={form.root_cause}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              placeholder="What caused the failure?"
            />
          </div>

          <div>
            <label className={labelClass}>
              Corrective Action Taken *
            </label>
            <textarea
              name="corrective_action"
              value={form.corrective_action}
              onChange={handleChange}
              className={inputClass}
              rows={4}
              placeholder="Describe the repair or maintenance work performed..."
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              Spare Parts Used
            </label>
            <textarea
              name="spare_used"
              value={form.spare_used}
              onChange={handleChange}
              className={inputClass}
              rows={2}
              placeholder="Mention spare parts and quantities, if any..."
            />
          </div>

          <div>
            <label className={labelClass}>
              Downtime (Minutes)
            </label>
            <input
              type="number"
              name="downtime_minutes"
              value={form.downtime_minutes}
              onChange={handleChange}
              className={inputClass}
              min="0"
              step="1"
              placeholder="Enter total downtime in minutes"
            />
          </div>

          <div>
            <label className={labelClass}>
              Additional Remarks
            </label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              className={inputClass}
              rows={3}
              placeholder="Any additional observations or recommendations..."
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting Report..." : "Submit for Company Approval"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Submitting this report does not automatically complete the job.
            The company must review and approve it.
          </p>
        </form>
      </div>
    </div>
  );
}