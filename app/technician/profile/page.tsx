"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Skill = {
  id: string;
  name: string;
  category: string;
};

export default function TechnicianProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [city, setCity] = useState("");
  const [industrialArea, setIndustrialArea] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [about, setAbout] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [availability, setAvailability] = useState("available");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

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

    // Confirm technician role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "technician"
    ) {
      setMessage(
        "This page is only available to technician accounts."
      );
      setLoading(false);
      return;
    }

    // Load skills list
    const { data: skillData, error: skillsError } =
      await supabase
        .from("skills")
        .select("id, name, category")
        .order("category")
        .order("name");

    if (skillsError) {
      console.error(skillsError);
      setMessage("Unable to load skills.");
    } else {
      setSkills(skillData || []);
    }

    // Load technician profile
    const { data: technician } = await supabase
      .from("technicians")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (technician) {
      setCity(technician.city || "");
      setIndustrialArea(technician.industrial_area || "");

      setYearsExperience(
        technician.years_experience !== null
          ? String(technician.years_experience)
          : ""
      );

      setAbout(technician.about || "");

      setHourlyRate(
        technician.hourly_rate !== null
          ? String(technician.hourly_rate)
          : ""
      );

      setAvailability(
        technician.availability_status || "available"
      );

      // Load technician skills
      const { data: technicianSkills } = await supabase
        .from("technician_skills")
        .select("skill_id")
        .eq("technician_id", technician.id);

      setSelectedSkills(
        technicianSkills?.map((item) => item.skill_id) || []
      );
    }

    setLoading(false);
  }

  function toggleSkill(skillId: string) {
    setSelectedSkills((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }

      return [...current, skillId];
    });
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

    // Save technician profile
    const { data: technician, error: technicianError } =
      await supabase
        .from("technicians")
        .upsert(
          {
            profile_id: user.id,
            city: city || null,
            industrial_area: industrialArea || null,
            years_experience: yearsExperience
              ? Number(yearsExperience)
              : 0,
            about: about || null,
            hourly_rate: hourlyRate
              ? Number(hourlyRate)
              : null,
            availability_status: availability,
          },
          {
            onConflict: "profile_id",
          }
        )
        .select()
        .single();

    if (technicianError || !technician) {
      console.error(technicianError);

      setMessage(
        `Error saving technician profile: ${
          technicianError?.message || "Unknown error"
        }`
      );

      setSaving(false);
      return;
    }

    // Remove previous skills
    const { error: deleteError } = await supabase
      .from("technician_skills")
      .delete()
      .eq("technician_id", technician.id);

    if (deleteError) {
      console.error(deleteError);

      setMessage(
        `Profile saved, but old skills could not be updated: ${deleteError.message}`
      );

      setSaving(false);
      return;
    }

    // Insert selected skills
    if (selectedSkills.length > 0) {
      const skillRows = selectedSkills.map((skillId) => ({
        technician_id: technician.id,
        skill_id: skillId,
        experience_years: Number(yearsExperience) || 0,
      }));

      const { error: skillError } = await supabase
        .from("technician_skills")
        .insert(skillRows);

      if (skillError) {
        console.error(skillError);

        setMessage(
          `Profile saved, but skills could not be saved: ${skillError.message}`
        );

        setSaving(false);
        return;
      }
    }

    setMessage("Technician profile saved successfully.");
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Technician Profile
          </h1>

          <p className="mt-2 text-slate-400">
            Complete your profile so companies can find you.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          {/* LOCATION */}

          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Location
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm">
                  City
                </label>

                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 p-3"
                  placeholder="Pune"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  Industrial Area
                </label>

                <input
                  type="text"
                  value={industrialArea}
                  onChange={(e) =>
                    setIndustrialArea(e.target.value)
                  }
                  className="w-full rounded-lg bg-slate-800 p-3"
                  placeholder="Chakan MIDC"
                />
              </div>
            </div>
          </section>

          {/* EXPERIENCE */}

          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Professional Information
            </h2>

            <div>
              <label className="mb-2 block text-sm">
                Years of Experience
              </label>

              <input
                type="number"
                min="0"
                value={yearsExperience}
                onChange={(e) =>
                  setYearsExperience(e.target.value)
                }
                className="w-full rounded-lg bg-slate-800 p-3"
                placeholder="5"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm">
                About You
              </label>

              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={5}
                className="w-full rounded-lg bg-slate-800 p-3"
                placeholder="Describe your maintenance experience, industries worked in, machines handled, PLC experience, etc."
              />
            </div>
          </section>

          {/* RATE */}

          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Availability & Rate
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm">
                  Hourly Rate (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) =>
                    setHourlyRate(e.target.value)
                  }
                  className="w-full rounded-lg bg-slate-800 p-3"
                  placeholder="600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  Availability
                </label>

                <select
                  value={availability}
                  onChange={(e) =>
                    setAvailability(e.target.value)
                  }
                  className="w-full rounded-lg bg-slate-800 p-3"
                >
                  <option value="available">
                    Available
                  </option>

                  <option value="busy">
                    Currently Busy
                  </option>

                  <option value="unavailable">
                    Unavailable
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* SKILLS */}

          <section>
            <h2 className="mb-2 text-xl font-semibold">
              Technical Skills
            </h2>

            <p className="mb-4 text-sm text-slate-400">
              Select all technologies you are comfortable
              working with.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => {
                const selected = selectedSkills.includes(
                  skill.id
                );

                return (
                  <button
                    type="button"
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={`rounded-lg border p-3 text-left ${
                      selected
                        ? "border-white bg-white text-slate-950"
                        : "border-slate-700 bg-slate-800"
                    }`}
                  >
                    <div className="font-medium">
                      {skill.name}
                    </div>

                    <div
                      className={`text-xs ${
                        selected
                          ? "text-slate-600"
                          : "text-slate-400"
                      }`}
                    >
                      {skill.category}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-white p-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Technician Profile"}
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