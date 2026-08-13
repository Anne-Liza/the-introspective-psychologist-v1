import { Link } from "react-router";

export function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-81px)] max-w-3xl items-center px-6 py-16">
      <section className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Controlled access
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
          Public registration is not open for this Launch Kit staging environment.
        </h1>

        <p className="mt-5 text-lg leading-8 text-slate-600">
          Launch Kit is currently deployed as a private factory dashboard. New users should be
          invited or created by an approved administrator after roles and permissions are confirmed.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Go to login
          </Link>

          <Link
            to="/"
            className="rounded-2xl border bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-50"
          >
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
