import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useAuth } from "../context/AuthContext";

const loginCopy = {
  "eyebrow": "Practice admin",
  "title": "Sign in to manage the practice.",
  "description": "This private dashboard is for approved practice administrators. Use it to manage appointments, services, availability, payments, content, and client communication.",
  "card_title": "Admin login",
  "card_description": "Enter the administrator credentials configured for this practice.",
  "return_label": "Return to the website",
  "stat_1": "Appointments",
  "stat_2": "Client records",
  "stat_3": "Payments"
};
const AUTH_NOTICE_KEY = "launchkit_auth_notice";

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [notice] = useState(() => {
    const routeState = location.state as {
      notice?: string;
    } | null;

    const storedNotice = (() => {
      try {
        const value =
          sessionStorage.getItem(AUTH_NOTICE_KEY);
        sessionStorage.removeItem(AUTH_NOTICE_KEY);
        return value;
      } catch {
        return null;
      }
    })();

    if (storedNotice === "session-expired") {
      return "Your session expired. Please sign in again.";
    }

    return routeState?.notice ?? "";
  });

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError(
        "Login failed. Check your email and password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      data-ui-contract="auth.login"
      className="mx-auto flex min-h-[calc(100vh-81px)] max-w-6xl items-center px-6 py-16"
    >
      <section className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#5f7f47]">
            {loginCopy.eyebrow}
          </p>

          <h1 className="mt-4 max-w-2xl text-5xl font-bold tracking-tight text-[#132316]">
            {loginCopy.title}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#405341]">
            {loginCopy.description}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              loginCopy.stat_1,
              loginCopy.stat_2,
              loginCopy.stat_3,
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[#dce8d4] bg-white p-4 text-sm font-semibold text-[#253a28]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[#dce8d4] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-[#132316]">
            {loginCopy.card_title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#405341]">
            {loginCopy.card_description}
          </p>

          {notice ? (
            <p
              className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800"
              role="status"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
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
                htmlFor="login-email"
                className="text-sm font-medium text-[#253a28]"
              >
                Email
              </label>

              <input
                id="login-email"
                className="mt-1 w-full rounded-xl border border-[#dce8d4] px-3 py-2 focus:border-[#82a85f] focus:outline-none focus:ring-2 focus:ring-[#dce8d4]"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium text-[#253a28]"
                >
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-[#132316] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                id="login-password"
                className="mt-1 w-full rounded-xl border border-[#dce8d4] px-3 py-2 focus:border-[#82a85f] focus:outline-none focus:ring-2 focus:ring-[#dce8d4]"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#132316] px-4 py-3 font-semibold text-white hover:bg-[#223b26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Signing in..."
                : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-sm leading-6 text-[#405341]">
            Access is restricted to approved administrators.{" "}
            <Link
              to="/"
              className="font-semibold text-[#132316]"
            >
              {loginCopy.return_label}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
