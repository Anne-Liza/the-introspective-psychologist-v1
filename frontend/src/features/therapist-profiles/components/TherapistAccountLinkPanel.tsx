import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { isAxiosError } from "axios";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { Button } from "../../../components/ui/Button";
import {
  fetchTherapistAccountOptions,
  linkTherapistProfileAccount,
} from "../lib/therapistProfilesApi";
import type {
  TherapistAccountOption,
  TherapistProfile,
} from "../lib/therapistProfilesApi";

const selectClassName =
  "w-full rounded-2xl border border-slate-300 "
  + "bg-white px-4 py-3 text-sm text-slate-950 "
  + "outline-none focus:border-slate-900 "
  + "focus:ring-2 focus:ring-slate-200";

type Props = {
  profiles: TherapistProfile[];
  canManage: boolean;
};

function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return "The therapist account link could not be saved.";
}

function accountLabel(
  account: TherapistAccountOption,
) {
  return account.full_name
    ? `${account.full_name} · ${account.email}`
    : account.email;
}

export function TherapistAccountLinkPanel({
  profiles,
  canManage,
}: Props) {
  const queryClient = useQueryClient();

  const [profileId, setProfileId] = useState("");
  const [userId, setUserId] = useState("");

  const selectedProfile = useMemo(
    () =>
      profiles.find(
        (profile) => profile.id === profileId,
      ),
    [profiles, profileId],
  );

  const accountOptionsQuery = useQuery({
    queryKey: ["therapist-account-options"],
    queryFn: fetchTherapistAccountOptions,
    enabled: canManage,
  });

  const options = accountOptionsQuery.data ?? [];

  useEffect(() => {
    if (!selectedProfile) {
      setUserId("");
      return;
    }

    setUserId(selectedProfile.user_id ?? "");
  }, [selectedProfile]);

  const selectedAccount = useMemo(
    () =>
      options.find(
        (option) =>
          option.id === selectedProfile?.user_id,
      ),
    [options, selectedProfile],
  );

  const linkMutation = useMutation({
    mutationFn: linkTherapistProfileAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["therapist-profiles"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["therapist-account-options"],
      });
    },
  });

  function saveLink() {
    if (!profileId || !userId) {
      return;
    }

    linkMutation.mutate({
      profileId,
      userId,
    });
  }

  function unlinkAccount() {
    if (!selectedProfile?.user_id) {
      return;
    }

    const confirmed = window.confirm(
      `Unlink the login account from `
      + `${selectedProfile.full_name}?`,
    );

    if (!confirmed) {
      return;
    }

    linkMutation.mutate({
      profileId: selectedProfile.id,
      userId: null,
    });
  }

  if (!canManage) {
    return null;
  }

  const linkedAccountMissing =
    Boolean(selectedProfile?.user_id)
    && !selectedAccount;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Staff access
        </p>

        <h3 className="text-xl font-bold text-slate-950">
          Link therapist login accounts
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Linking a Therapist-role account allows that
          person to manage their own availability.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Therapist profile
          </span>

          <select
            value={profileId}
            onChange={(event) =>
              setProfileId(event.target.value)
            }
            className={selectClassName}
          >
            <option value="">
              Choose a therapist profile
            </option>

            {profiles.map((profile) => (
              <option
                key={profile.id}
                value={profile.id}
              >
                {profile.full_name}
                {profile.user_id
                  ? " · account linked"
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Therapist login account
          </span>

          <select
            value={userId}
            onChange={(event) =>
              setUserId(event.target.value)
            }
            className={selectClassName}
            disabled={
              !profileId
              || accountOptionsQuery.isLoading
            }
          >
            <option value="">
              Choose an active Therapist account
            </option>

            {linkedAccountMissing
            && selectedProfile?.user_id ? (
              <option
                value={selectedProfile.user_id}
              >
                Linked account is no longer eligible
              </option>
            ) : null}

            {options.map((account) => {
              const linkedElsewhere = Boolean(
                account.linked_profile_id
                && account.linked_profile_id
                  !== profileId,
              );

              return (
                <option
                  key={account.id}
                  value={account.id}
                  disabled={linkedElsewhere}
                >
                  {accountLabel(account)}
                  {linkedElsewhere
                    ? " · linked elsewhere"
                    : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {selectedProfile ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">
            Current link
          </p>

          <p className="mt-1">
            {selectedProfile.user_id
              ? selectedAccount
                ? accountLabel(selectedAccount)
                : (
                    "The linked account is inactive, "
                    + "missing the Therapist role, or "
                    + "otherwise unavailable."
                  )
              : "No login account is linked."}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={saveLink}
          disabled={
            !profileId
            || !userId
            || linkMutation.isPending
            || userId === selectedProfile?.user_id
          }
        >
          {linkMutation.isPending
            ? "Saving..."
            : "Link account"}
        </Button>

        {selectedProfile?.user_id ? (
          <Button
            type="button"
            variant="danger"
            onClick={unlinkAccount}
            disabled={linkMutation.isPending}
          >
            Unlink account
          </Button>
        ) : null}
      </div>

      {accountOptionsQuery.isError ? (
        <p className="mt-3 text-sm text-red-600">
          Eligible therapist accounts could not be loaded.
        </p>
      ) : null}

      {linkMutation.isError ? (
        <p className="mt-3 text-sm text-red-600">
          {errorMessage(linkMutation.error)}
        </p>
      ) : null}

      {!accountOptionsQuery.isLoading
      && !options.length ? (
        <p className="mt-3 text-sm text-slate-500">
          No active accounts currently have the Therapist
          role. Create or invite the account and assign the
          role before linking it.
        </p>
      ) : null}
    </section>
  );
}
