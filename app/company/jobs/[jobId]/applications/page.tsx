"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  status: string;
  location: string | null;
};

type Technician = {
  id: string;
  profile_id: string;
  city: string | null;
  industrial_area: string | null;
  years_experience: number;
  about: string | null;
  availability_status: string;
  verification_status: string;
};

type TechnicianName = {
  technician_id: string;
  full_name: string | null;
};

type TechnicianSkill = {
  technician_id: string;
  skill_id: string;
  experience_years: number;
};

type Skill = {
  id: string;
  name: string;
  category: string | null;
};

type ApplicationCard = Application & {
  technician_name: string;
  city: string | null;
  industrial_area: string | null;
  years_experience: number;
  about: string | null;
  availability_status: string;
  verification_status: string;
  skills: string[];
};

export default function JobApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<ApplicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
const [sortBy, setSortBy] = useState("best_match");
const [locationFilter, setLocationFilter] = useState("all");
const [availabilityFilter, setAvailabilityFilter] = useState("all");
const [verificationFilter, setVerificationFilter] = useState("all");
const [priceFilter, setPriceFilter] = useState("all");
const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);

  async function loadApplications() {
    setLoading(true);
    setError("");

    try {
      // 1. Verify logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. Verify company role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.role !== "company") {
        router.replace("/login");
        return;
      }

      // 3. Get company record
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("profile_id", user.id)
        .single();

      if (companyError) throw companyError;

      // 4. Verify job belongs to this company
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, company_id, title, status, location")
        .eq("id", jobId)
        .eq("company_id", company.id)
        .single();

      if (jobError) throw jobError;

      setJob(jobData as Job);

      // 5. Fetch applications for this job
      const { data: applicationData, error: applicationError } =
        await supabase
          .from("job_applications")
          .select(
            "id, job_id, technician_id, proposed_rate, message, status, created_at"
          )
          .eq("job_id", jobId)
          .order("created_at", { ascending: false });

      if (applicationError) throw applicationError;

      const applicationList = (applicationData || []) as Application[];

      if (applicationList.length === 0) {
        setApplications([]);
        return;
      }

      // Exclude withdrawn applications from company review
      const visibleApplications = applicationList.filter(
        (application) => application.status.toLowerCase() !== "withdrawn"
      );

      if (visibleApplications.length === 0) {
        setApplications([]);
        return;
      }

      const technicianIds = [
        ...new Set(
          visibleApplications.map((application) => application.technician_id)
        ),
      ];

      // 6. Fetch technician details
      const { data: technicianData, error: technicianError } = await supabase
        .from("technicians")
        .select(
          "id, profile_id, city, industrial_area, years_experience, about, availability_status, verification_status"
        )
        .in("id", technicianIds);

      if (technicianError) throw technicianError;

      const technicianList = (technicianData || []) as Technician[];

      // 7. Fetch technician names from public view
      const { data: nameData, error: nameError } = await supabase
        .from("technician_public_profiles")
        .select("technician_id, full_name")
        .in("technician_id", technicianIds);

      if (nameError) throw nameError;

      const nameList = (nameData || []) as TechnicianName[];

      // 8. Fetch technician skills
      const { data: technicianSkillData, error: technicianSkillError } =
        await supabase
          .from("technician_skills")
          .select("technician_id, skill_id, experience_years")
          .in("technician_id", technicianIds);

      if (technicianSkillError) throw technicianSkillError;

      const technicianSkillList = (technicianSkillData ||
        []) as TechnicianSkill[];

      const skillIds = [
        ...new Set(
          technicianSkillList.map((item) => item.skill_id)
        ),
      ];

      // 9. Fetch skill names
      let skillList: Skill[] = [];

      if (skillIds.length > 0) {
        const { data: skillsData, error: skillsError } = await supabase
          .from("skills")
          .select("id, name, category")
          .in("id", skillIds);

        if (skillsError) throw skillsError;

        skillList = (skillsData || []) as Skill[];
      }

      // 10. Prepare lookup maps
      const technicianMap = new Map(
        technicianList.map((technician) => [technician.id, technician])
      );

      const nameMap = new Map(
        nameList.map((item) => [
          item.technician_id,
          item.full_name,
        ])
      );

      const skillMap = new Map(
        skillList.map((skill) => [skill.id, skill])
      );

      // 11. Combine application and technician information
      const formattedApplications: ApplicationCard[] =
        visibleApplications.map((application) => {
          const technician = technicianMap.get(
            application.technician_id
          );

          const technicianSkills = technicianSkillList
  .filter(
    (item) =>
      item.technician_id === application.technician_id
  )
  .map((item) => {
    const skill = skillMap.get(item.skill_id);
    return skill?.name || "Unknown skill";
  });

          return {
            ...application,
            technician_name:
              nameMap.get(application.technician_id) ||
              "Technician",
            city: technician?.city || null,
            industrial_area: technician?.industrial_area || null,
            years_experience:
              technician?.years_experience || 0,
            about: technician?.about || null,
            availability_status:
              technician?.availability_status || "Not specified",
            verification_status:
              technician?.verification_status || "Not specified",
            skills: technicianSkills,
          };
        });

      setApplications(formattedApplications);
    } catch (err) {
      console.error("Application loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (jobId) {
      loadApplications();
    }
  }, [jobId]);

  // Accept or reject an application
  async function updateApplication(
  applicationId: string,
  newStatus: "accepted" | "rejected"
) {
  const confirmed = window.confirm(
    newStatus === "accepted"
      ? "Are you sure you want to accept this technician?"
      : "Are you sure you want to reject this application?"
  );

  if (!confirmed) return;

  setProcessingId(applicationId);
  setActionMessage("");
  setError("");

  try {
    // Ask Supabase to process the decision securely.
    // Accepting also creates the assignment, rejects other pending
    // applications, and changes the job status to "assigned".
    const { data, error: rpcError } = await supabase.rpc(
      "company_decide_job_application",
      {
        p_application_id: applicationId,
        p_decision: newStatus,
      }
    );

    if (rpcError) throw rpcError;

    if (!data || data.success !== true) {
      throw new Error("Unable to process this application decision.");
    }

    setActionMessage(
      newStatus === "accepted"
        ? "Technician accepted successfully. The job has been assigned."
        : "Application rejected successfully."
    );

    // Refresh the application list to show updated statuses.
    await loadApplications();
  } catch (err: any) {
  console.error("Application decision error:", err);

  setError(
    err?.message ||
    err?.details ||
    err?.hint ||
    JSON.stringify(err) ||
    "Unknown application error."
  );
} finally {
    setProcessingId(null);
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

  function formatDate(date: string) {
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

      default:
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
    }
  }
// Filter and sort applications
const filteredApplications = applications
  .filter((application) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      application.technician_name.toLowerCase().includes(search) ||
      (application.city || "").toLowerCase().includes(search) ||
      (application.industrial_area || "").toLowerCase().includes(search) ||
      application.skills.some((skill) =>
        skill.toLowerCase().includes(search)
      );

    const matchesLocation =
      locationFilter === "all" ||
      (application.city || "").toLowerCase() === locationFilter.toLowerCase();

    const matchesAvailability =
      availabilityFilter === "all" ||
      application.availability_status.toLowerCase() ===
        availabilityFilter.toLowerCase();

    const matchesVerification =
      verificationFilter === "all" ||
      application.verification_status.toLowerCase() ===
        verificationFilter.toLowerCase();

    const rate = application.proposed_rate;

    const matchesPrice =
      priceFilter === "all" ||
      (priceFilter === "under500" && rate !== null && rate < 500) ||
      (priceFilter === "500to1000" && rate !== null && rate >= 500 && rate <= 1000) ||
      (priceFilter === "above1000" && rate !== null && rate > 1000);

    return (
      matchesSearch &&
      matchesLocation &&
      matchesAvailability &&
      matchesVerification &&
      matchesPrice
    );
  })
  .sort((a, b) => {
    if (sortBy === "price_low") {
      return (a.proposed_rate ?? Infinity) - (b.proposed_rate ?? Infinity);
    }

    if (sortBy === "experience") {
      return b.years_experience - a.years_experience;
    }

    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    // Best Match: prioritise skills, verification, experience and availability
    const score = (application: ApplicationCard) => {
      let result = 0;

      if (application.skills.length > 0) result += 2;
      if (application.verification_status.toLowerCase() === "verified") result += 5;
      if (application.availability_status.toLowerCase() === "available") result += 3;

      result += Math.min(application.years_experience, 10);

      return result;
    };

    return score(b) - score(a);
  });
  const acceptedApplication = applications.some(
    (application) => application.status.toLowerCase() === "accepted"
  );

  const pendingCount = applications.filter(
    (application) => application.status.toLowerCase() === "pending"
  ).length;

  const acceptedCount = applications.filter(
    (application) => application.status.toLowerCase() === "accepted"
  ).length;

  const rejectedCount = applications.filter(
    (application) => application.status.toLowerCase() === "rejected"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
              Company Dashboard
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Job Applications
            </h1>

            <p className="mt-2 text-slate-400">
              Review and compare technicians before making your selection.
            </p>

            {job && (
              <p className="mt-3 text-lg font-semibold text-blue-300">
                {job.title}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadApplications}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Refresh
            </button>

            <Link
              href="/company/jobs"
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 hover:bg-blue-500/20"
            >
              Back to My Jobs
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading applications...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}

        {/* Success */}
        {!loading && actionMessage && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
            {actionMessage}
          </div>
        )}

        {/* Application Summary */}
        {!loading && !error && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Total Applications
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {applications.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Pending
                </p>
                <p className="mt-2 text-3xl font-bold text-yellow-400">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">
                  Accepted
                </p>
                <p className="mt-2 text-3xl font-bold text-green-400">
                  {acceptedCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
  <p className="text-sm text-slate-400">Rejected</p>
  <p className="mt-2 text-3xl font-bold text-red-400">
    {rejectedCount}
  </p>
</div>
            </div>

            {/* Rejected count */}
            <p className="mb-6 text-sm text-slate-500">
              Rejected applications: {rejectedCount}
            </p>

            {/* Accepted warning */}
            {acceptedApplication && (
              <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
                A technician has already been accepted for this job.
                No additional technician can be accepted.
              </div>
            )}

            {/* Empty state */}
            {applications.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
                <h2 className="text-xl font-semibold">
                  No applications received yet
                </h2>

                <p className="mt-3 text-slate-400">
                  Technician applications will appear here when someone applies.
                </p>
              </div>
            )}

            {/* Search and Filters */}
<div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">

  <input
    type="text"
    placeholder="Search technician by name, skill or location..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
  />

  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
    >
      <option value="best_match">Best Match</option>
      <option value="price_low">Lowest Price</option>
      <option value="experience">Most Experience</option>
      <option value="newest">Newest Applications</option>
    </select>

    <select
      value={locationFilter}
      onChange={(e) => setLocationFilter(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
    >
      <option value="all">All Locations</option>
      {[...new Set(applications.map((a) => a.city).filter(Boolean))].map((city) => (
        <option key={city} value={city!}>{city}</option>
      ))}
    </select>

    <select
      value={availabilityFilter}
      onChange={(e) => setAvailabilityFilter(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
    >
      <option value="all">All Availability</option>
      <option value="available">Available</option>
      <option value="busy">Busy</option>
    </select>

    <select
      value={verificationFilter}
      onChange={(e) => setVerificationFilter(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
    >
      <option value="all">All Verification</option>
      <option value="verified">Verified</option>
      <option value="pending">Pending Verification</option>
      <option value="rejected">Rejected Verification</option>
    </select>

    <select
      value={priceFilter}
      onChange={(e) => setPriceFilter(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
    >
      <option value="all">All Prices</option>
      <option value="under500">Below ₹500</option>
      <option value="500to1000">₹500 – ₹1,000</option>
      <option value="above1000">Above ₹1,000</option>
    </select>

  </div>
</div>

{/* Technician Results */}
<div className="space-y-4">

  {filteredApplications.length === 0 && (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
      No technicians match your search or filters.
    </div>
  )}

  {filteredApplications.map((application) => {

    const isPending = application.status.toLowerCase() === "pending";
    const isAccepted = application.status.toLowerCase() === "accepted";

    const isExpanded = expandedApplicationId === application.id;

    return (
      <div
        key={application.id}
        className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-500/40"
      >

        {/* Compact Technician Information */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-3">

              <h2 className="text-lg font-bold text-white">
                {application.technician_name}
              </h2>

              <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyle(application.status)}`}>
                {application.status}
              </span>

            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">

              <span>
                {application.years_experience} Years Experience
              </span>

              <span>
                {application.verification_status.toLowerCase() === "verified"
                  ? "✓ Verified"
                  : "Pending Verification"}
              </span>

              <span>
                {application.city || "Location not specified"}
                {application.industrial_area
                  ? `, ${application.industrial_area}`
                  : ""}
              </span>

              <span className="capitalize">
                {application.availability_status.replace(/_/g, " ")}
              </span>

            </div>

            {/* Skills */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Skills
              </p>

              {application.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {application.skills.map((skill, index) => (
                    <span
                      key={`${skill}-${index}`}
                      className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No skills listed</p>
              )}
            </div>

          </div>

          {/* Price and Actions */}
          <div className="flex flex-col gap-3 lg:min-w-[190px] lg:items-end">

            <p className="text-2xl font-bold text-green-400">
              {formatAmount(application.proposed_rate)}
            </p>

            <button
              onClick={() =>
                setExpandedApplicationId(isExpanded ? null : application.id)
              }
              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20"
            >
              {isExpanded ? "Hide Full Profile" : "View Full Profile"}
            </button>

          </div>

        </div>

        {/* Expanded Full Profile */}
        {isExpanded && (
          <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">

            <div>
              <p className="text-sm font-semibold text-slate-300">
                About Technician
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                {application.about || "No introduction provided."}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-300">
                Application Message
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                {application.message || "No message provided."}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Applied on: {formatDate(application.created_at)}
            </p>

          </div>
        )}

        {/* Accept and Reject */}
        {isPending && (
          <div className="mt-5 flex gap-3 border-t border-slate-800 pt-5">

            <button
              onClick={() => updateApplication(application.id, "accepted")}
              disabled={processingId === application.id || acceptedApplication}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processingId === application.id ? "Processing..." : "Accept"}
            </button>

            <button
              onClick={() => updateApplication(application.id, "rejected")}
              disabled={processingId === application.id}
              className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40"
            >
              Reject
            </button>

          </div>
        )}

        {isAccepted && (
          <div className="mt-5 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center text-sm font-semibold text-green-400">
            ✓ This technician has been selected.
          </div>
        )}

      </div>
    );
  })}

</div>
          </>
        )}
      </div>
    </main>
  );
}