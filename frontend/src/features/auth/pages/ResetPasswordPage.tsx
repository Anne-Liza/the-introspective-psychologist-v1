import { FormEvent, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router";

import { apiClient } from "../../../lib/api-client";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] =
    useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError(
        "This password-reset link is missing its token. Request a new link.",
      );
      return;
    }

    if (newPassword !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      navigate("/login", {
        replace: true,
        state: {
          notice:
            "Password reset successfully. You can now sign in.",
        },
      });
    } catch {
      setError(
        "This link is invalid or expired, or the password does not meet the security requirements.",
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
          Choose a new password
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter and confirm the new password for your
          account.
        </p>

        {!token ? (
          <p
            className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            This password-reset link is incomplete.
            Request a new link below.
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
              htmlFor="new-password"
              className="text-sm font-medium text-slate-700"
            >
              New password
            </label>

            <input
              id="new-password"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className="text-sm font-medium text-slate-700"
            >
              Confirm new password
            </label>

            <input
              id="confirm-new-password"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value)
              }
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Updating..."
              : "Update password"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link
            to="/forgot-password"
            className="font-semibold text-slate-950 hover:underline"
          >
            Request a new link
          </Link>

          <Link
            to="/login"
            className="font-semibold text-slate-950 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}
