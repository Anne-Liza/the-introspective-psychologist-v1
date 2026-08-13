import { useMutation } from "@tanstack/react-query";
import { FormEvent, useLayoutEffect, useState } from "react";
import { Link } from "react-router";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";
import {
  invitationTokenFromUrl,
  passwordMeetsRequirements,
  passwordRequirements,
} from "../lib/invitation-acceptance";

const INVITATION_ERROR =
  "This invitation is invalid or has expired. Please contact your practice administrator.";

async function acceptInvitation(payload: {
  token: string;
  full_name: string;
  password: string;
}) {
  const response = await apiClient.post("/invitations/accept", payload);
  return response.data;
}

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li className={met ? "text-[#4d6b42]" : "text-[#788176]"}>
      <span aria-hidden="true">{met ? "✓" : "○"}</span> {children}
    </li>
  );
}

export function AcceptInvitationPage() {
  const [token] = useState(() =>
    invitationTokenFromUrl(window.location.hash, window.location.search),
  );
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const requirements = passwordRequirements(password);

  useLayoutEffect(() => {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
  }, []);

  const mutation = useMutation({ mutationFn: acceptInvitation });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError("");

    if (!passwordMeetsRequirements(password)) {
      setLocalError("Choose a password that meets all three requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("The passwords do not match.");
      return;
    }

    mutation.mutate({ token, full_name: fullName, password });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <div className="overflow-hidden rounded-[2rem] border border-[#dfe3d4] bg-white shadow-[0_24px_80px_rgba(55,65,48,0.12)]">
        <div className="bg-[#657455] px-6 py-7 text-[#fbfaf5] sm:px-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e8ecd9]">
            Team access
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Join the practice
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#edf0e4]">
            Complete your secure staff account. This link can only be used once.
          </p>
        </div>

        <div className="p-6 sm:p-9">
          {!token ? (
            <div className="rounded-3xl bg-[#f7ece8] p-5 text-sm leading-6 text-[#7d473b]">
              {INVITATION_ERROR}
            </div>
          ) : mutation.isSuccess ? (
            <div className="rounded-3xl bg-[#edf3e5] p-6 text-[#365032]">
              <h2 className="text-xl font-semibold">Your account is ready</h2>
              <p className="mt-2 text-sm leading-6">
                The invitation has been accepted. You can now use your email and
                password to sign in.
              </p>
              <Link
                to="/login"
                className="mt-5 inline-flex rounded-2xl bg-[#34422f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#253223]"
              >
                Continue to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Create password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <ul
                className="grid gap-1 text-xs sm:grid-cols-3"
                aria-label="Password requirements"
              >
                <Requirement met={requirements.hasMinimumLength}>
                  At least 12 characters
                </Requirement>
                <Requirement met={requirements.hasLetter}>
                  Includes a letter
                </Requirement>
                <Requirement met={requirements.hasNumber}>
                  Includes a number
                </Requirement>
              </ul>

              {localError ? (
                <p
                  className="rounded-2xl bg-[#fff4df] px-4 py-3 text-sm text-[#765524]"
                  role="alert"
                >
                  {localError}
                </p>
              ) : null}

              {mutation.isError ? (
                <p
                  className="rounded-2xl bg-[#f7ece8] px-4 py-3 text-sm text-[#7d473b]"
                  role="alert"
                >
                  {INVITATION_ERROR}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={mutation.isPending || !fullName.trim()}
                className="w-full bg-[#34422f] py-3 hover:bg-[#253223]"
              >
                {mutation.isPending
                  ? "Creating your account..."
                  : "Create staff account"}
              </Button>

              <p className="text-center text-xs leading-5 text-[#788176]">
                If you did not expect this invitation, close this page and
                contact the practice directly.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
