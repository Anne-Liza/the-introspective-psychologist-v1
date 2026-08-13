import { FormEvent, useState } from "react";
import { Link } from "react-router";

import { apiClient } from "../../../lib/api-client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      await apiClient.post("/auth/forgot-password", {
        email,
      });

      setMessage(
        "If an account exists for that email, password reset instructions have been sent.",
      );
    } catch {
      setError(
        "We could not submit the request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-81px)] max-w-xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Account recovery
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Reset your password
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter your account email. We will send a secure
          password-reset link when the account exists.
        </p>

        {message ? (
          <p
            className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"
            role="status"
          >
            {message}
          </p>
        ) : null}

        {error ? (
          <p
            className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="forgot-password-email"
              className="text-sm font-medium text-slate-700"
            >
              Email
            </label>

            <input
              id="forgot-password-email"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Sending..."
              : "Send reset link"}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-semibold text-slate-950 hover:underline"
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}
