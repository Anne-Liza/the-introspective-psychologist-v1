import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-81px)] max-w-2xl items-center px-6 py-16 text-center">
      <section className="w-full rounded-3xl border bg-white p-10 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          404
        </p>

        <h1 className="mt-3 text-4xl font-bold text-slate-950">
          Page not found
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          The address may be incorrect, or the page may
          have moved.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl border px-4 py-2 font-semibold text-slate-800"
          >
            Go home
          </Link>

          <Link
            to="/login"
            className="rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white"
          >
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
}
