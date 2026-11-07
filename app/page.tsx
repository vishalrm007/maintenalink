import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Navigation Bar */}
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <Link href="/" className="text-2xl font-bold tracking-tight">
            Maintena<span className="text-blue-400">Link</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-slate-600 px-5 py-2 font-semibold hover:bg-slate-800"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-lg bg-white px-5 py-2 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Sign Up
            </Link>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">

          <div className="mb-6 inline-block rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Industrial Maintenance Marketplace
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Find the right maintenance professional for your factory.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            MaintenaLink connects manufacturing companies with skilled
            industrial maintenance technicians for breakdowns, preventive
            maintenance, troubleshooting and technical support.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">

            <Link
              href="/register?role=company"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              I&apos;m a Company
            </Link>

            <Link
              href="/register?role=technician"
              className="rounded-lg border border-slate-600 px-6 py-3 font-semibold hover:bg-slate-900"
            >
              I&apos;m a Technician
            </Link>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-slate-800">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">

          <Feature
            title="Find Skilled Technicians"
            text="Search professionals by skill, experience, location and machine expertise."
          />

          <Feature
            title="Post Maintenance Jobs"
            text="Post breakdown, PM, installation and troubleshooting requirements."
          />

          <Feature
            title="Build Maintenance History"
            text="Keep technician reports, machine history and maintenance records in one place."
          />

        </div>
      </section>

    </main>
  );
}

function Feature({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 leading-7 text-slate-400">{text}</p>
    </div>
  );
}