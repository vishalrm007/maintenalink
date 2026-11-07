"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Technician = {
  id: string;
  profile_id: string;
  city: string | null;
  industrial_area: string | null;
  years_experience: number;
  about: string | null;
  hourly_rate: number | null;
  availability_status: string;
  verification_status: string;
  full_name: string | null;
};

type Skill = {
  technician_id: string;
  skill_id: string;
  experience_years: number;
  name: string | null;
  category: string | null;
};

export default function TechnicianMarketplace() {
  const router = useRouter();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [skillWarning, setSkillWarning] = useState("");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [minimumExperience, setMinimumExperience] = useState("0");

  useEffect(() => {
    let isMounted = true;

    async function loadMarketplace() {
      const supabase = createClient();

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
          .maybeSingle();

        if (profileError || !profile) {
          throw new Error(profileError?.message || "Unable to load your user profile.");
        }

        if (profile.role !== "company") {
          router.replace("/technician/dashboard");
          return;
        }

        // Public marketplace data only; do not fetch private contact details.
        const { data: technicianRows, error: technicianError } = await supabase
          .from("technicians")
          .select("id, profile_id, city, industrial_area, years_experience, about, hourly_rate, availability_status, verification_status")
          .order("years_experience", { ascending: false });

        if (technicianError) {
          throw new Error(`Unable to load technicians: ${technicianError.message}`);
        }

        // This existing view contains technician_id and full_name.
        const { data: publicProfiles, error: publicProfileError } = await supabase
          .from("technician_public_profiles")
          .select("technician_id, full_name");

        if (publicProfileError) {
          console.error("Public technician profile query:", publicProfileError);
        }

        const nameByTechnicianId = new Map<string, string | null>(
          (publicProfiles ?? []).map((item) => [
            item.technician_id as string,
            item.full_name as string | null,
          ])
        );

        const technicianList: Technician[] = (technicianRows ?? []).map((item) => ({
          ...(item as Omit<Technician, "full_name">),
          full_name: nameByTechnicianId.get(item.id) ?? null,
        }));

        // Load skill links and the skill catalogue separately.
        const { data: technicianSkillRows, error: technicianSkillsError } = await supabase
          .from("technician_skills")
          .select("technician_id, skill_id, experience_years");

        if (technicianSkillsError) {
          console.error("Technician skills query:", technicianSkillsError);
          if (isMounted) {
            setSkillWarning("Technician profiles loaded, but skills could not be read. Please check the SELECT policy for technician_skills.");
          }
        }

        const skillIds = [...new Set((technicianSkillRows ?? []).map((item) => item.skill_id))];
        let skillRows: { id: string; name: string; category: string | null }[] = [];

        if (skillIds.length > 0) {
          const { data, error: skillsError } = await supabase
            .from("skills")
            .select("id, name, category")
            .in("id", skillIds);

          if (skillsError) {
            console.error("Skills catalogue query:", skillsError);
            if (isMounted) {
              setSkillWarning("Technician profiles loaded, but the skills catalogue could not be read. Please check the SELECT policy for skills.");
            }
          } else {
            skillRows = data ?? [];
          }
        }

        const skillById = new Map(skillRows.map((item) => [item.id, item]));
        const combinedSkills: Skill[] = (technicianSkillRows ?? []).map((item) => {
          const skill = skillById.get(item.skill_id);
          return {
            technician_id: item.technician_id,
            skill_id: item.skill_id,
            experience_years: item.experience_years,
            name: skill?.name ?? null,
            category: skill?.category ?? null,
          };
        });

        if (isMounted) {
          setTechnicians(technicianList);
          setSkills(combinedSkills);
        }
      } catch (error) {
        console.error("Marketplace loading error:", error);
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Something went wrong while loading the marketplace.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMarketplace();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((technician) => {
      const searchText = [
        technician.full_name ?? "",
        technician.city ?? "",
        technician.industrial_area ?? "",
        technician.about ?? "",
        `${technician.years_experience} years`,
      ].join(" ").toLowerCase();

      const matchesSearch = searchText.includes(search.trim().toLowerCase());
      const matchesCity = (technician.city ?? "").toLowerCase().includes(cityFilter.trim().toLowerCase());
      const technicianSkills = skills.filter((item) => item.technician_id === technician.id);
      const matchesSkill =
        !skillFilter.trim() ||
        technicianSkills.some((item) => (item.name ?? "").toLowerCase().includes(skillFilter.trim().toLowerCase()));
      const matchesExperience = technician.years_experience >= Number(minimumExperience);

      return matchesSearch && matchesCity && matchesSkill && matchesExperience;
    });
  }, [technicians, skills, search, cityFilter, skillFilter, minimumExperience]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Loading technician marketplace...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/company/dashboard" className="text-xl font-bold text-blue-400">
              MaintenaLink
            </Link>
            <p className="text-sm text-slate-400">Technician Marketplace</p>
          </div>
          <Link href="/company/dashboard" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">Find Maintenance Technicians</h1>
        <p className="mt-2 text-slate-300">
          Search technicians by experience, location and technical skills.
        </p>

        <section className="mt-8 grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Search</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, area or experience" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">City</label>
            <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="e.g. Pune, Mumbai" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Technical Skill</label>
            <input value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} placeholder="e.g. Siemens PLC" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Minimum Experience</label>
            <select value={minimumExperience} onChange={(event) => setMinimumExperience(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white">
              <option value="0">Any experience</option>
              <option value="1">1+ years</option>
              <option value="3">3+ years</option>
              <option value="5">5+ years</option>
              <option value="10">10+ years</option>
            </select>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-800 bg-red-950 p-4 text-red-200">{errorMessage}</div>
        )}
        {skillWarning && (
          <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950 p-4 text-amber-200">{skillWarning}</div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available Professionals</h2>
          <p className="text-sm text-slate-300">{filteredTechnicians.length} technician(s) found</p>
        </div>

        {filteredTechnicians.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h3 className="text-lg font-semibold">No technicians found</h3>
            <p className="mt-2 text-slate-300">Try changing your search or filters.</p>
          </div>
        ) : (
          <section className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredTechnicians.map((technician) => {
              const technicianSkills = skills.filter((item) => item.technician_id === technician.id);
              return (
                <article key={technician.id} className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{technician.full_name || "Technician"}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {technician.city || "Location not provided"}
                        {technician.industrial_area ? ` · ${technician.industrial_area}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium capitalize text-slate-200">
                      {technician.verification_status}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2 text-sm">
                    <p><strong>Experience:</strong> {technician.years_experience} years</p>
                    <p><strong>Availability:</strong> <span className="capitalize">{technician.availability_status}</span></p>
                    {technician.hourly_rate !== null && (
                      <p><strong>Hourly rate:</strong> ₹{Number(technician.hourly_rate).toLocaleString("en-IN")}</p>
                    )}
                  </div>

                  {technician.about && <p className="mt-4 text-sm leading-6 text-slate-300">{technician.about}</p>}

                  <div className="mt-5">
                    <p className="text-sm font-semibold">Technical Skills</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {technicianSkills.length === 0 ? (
                        <span className="text-sm text-slate-400">No skills added yet</span>
                      ) : (
                        technicianSkills.map((item) => (
                          <span key={item.skill_id} className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-200">
                            {item.name || "Technical Skill"}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-700 pt-4">
                    <p className="text-xs text-slate-400">Contact and hiring features will be added in the next modules.</p>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
