import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchPublicServices,
  fetchServices,
} from "../../services/lib/servicesApi";
import { fetchTherapistProfiles } from "../../therapist-profiles/lib/therapistProfilesApi";
import { AvailabilityExceptionManager } from "../components/AvailabilityExceptionManager";
import { AvailabilityRuleCard } from "../components/AvailabilityRuleCard";
import { AvailabilityRuleForm } from "../components/AvailabilityRuleForm";
import {
  createAvailabilityRule,
  createMyAvailabilityRule,
  deleteAvailabilityRule,
  deleteMyAvailabilityRule,
  fetchAvailabilityExceptions,
  fetchAvailabilityRules,
  fetchMyAvailabilityExceptions,
  fetchMyAvailabilityRules,
  updateAvailabilityRule,
  updateMyAvailabilityRule,
} from "../lib/availabilityApi";
import type {
  AvailabilityRule,
  AvailabilityRulePayload,
  MyAvailabilityRulePayload,
} from "../lib/availabilityApi";

function ownedRulePayload(
  payload: AvailabilityRulePayload,
): MyAvailabilityRulePayload {
  const owned = {
    ...payload,
  } as Partial<AvailabilityRulePayload>;

  delete owned.therapist_profile_id;

  return owned as MyAvailabilityRulePayload;
}

function apiErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

export function AvailabilityPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const canManageTeam = hasPermission("availability.read");

  const canCreate = canManageTeam
    ? hasPermission("availability.create")
    : hasPermission("availability.own.create");

  const canUpdate = canManageTeam
    ? hasPermission("availability.update")
    : hasPermission("availability.own.update");

  const canDelete = canManageTeam
    ? hasPermission("availability.delete")
    : hasPermission("availability.own.delete");

  const scope = canManageTeam ? "team" : "mine";

  const [editingRule, setEditingRule] =
    useState<AvailabilityRule | null>(null);
  const [ruleEditorOpen, setRuleEditorOpen] =
    useState(false);

  const {
    data: rules,
    isLoading: rulesLoading,
    isError: rulesError,
    error: rulesQueryError,
  } = useQuery({
    queryKey: ["availability-rules", scope],
    queryFn: canManageTeam
      ? fetchAvailabilityRules
      : fetchMyAvailabilityRules,
  });

  const {
    data: exceptions,
    isLoading: exceptionsLoading,
    isError: exceptionsError,
    error: exceptionsQueryError,
  } = useQuery({
    queryKey: ["availability-exceptions", scope],
    queryFn: canManageTeam
      ? fetchAvailabilityExceptions
      : fetchMyAvailabilityExceptions,
  });

  const {
    data: services,
    isLoading: servicesLoading,
  } = useQuery({
    queryKey: [
      "availability-services",
      canManageTeam ? "staff" : "public",
    ],
    queryFn: canManageTeam
      ? fetchServices
      : fetchPublicServices,
  });

  const {
    data: therapistProfiles,
    isLoading: therapistsLoading,
  } = useQuery({
    queryKey: ["availability-therapists"],
    queryFn: fetchTherapistProfiles,
    enabled: canManageTeam,
  });

  function invalidateAvailability() {
    void queryClient.invalidateQueries({
      queryKey: ["availability-rules"],
    });

    void queryClient.invalidateQueries({
      queryKey: ["availability-exceptions"],
    });
  }

  const createRuleMutation = useMutation({
    mutationFn: (
      payload: AvailabilityRulePayload,
    ) =>
      canManageTeam
        ? createAvailabilityRule(payload)
        : createMyAvailabilityRule(
            ownedRulePayload(payload),
          ),
    onSuccess: invalidateAvailability,
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: AvailabilityRulePayload;
    }) =>
      canManageTeam
        ? updateAvailabilityRule({
            id,
            data,
          })
        : updateMyAvailabilityRule({
            id,
            data: ownedRulePayload(data),
          }),
    onSuccess: invalidateAvailability,
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) =>
      canManageTeam
        ? deleteAvailabilityRule(id)
        : deleteMyAvailabilityRule(id),
    onSuccess: () => {
      setEditingRule(null);
      invalidateAvailability();
    },
  });

  async function saveRule(
    payloads: AvailabilityRulePayload[],
  ) {
    if (!payloads.length) {
      return;
    }

    if (editingRule) {
      await updateRuleMutation.mutateAsync({
        id: editingRule.id,
        data: payloads[0],
      });

      setEditingRule(null);
      setRuleEditorOpen(false);
      return;
    }

    for (const payload of payloads) {
      await createRuleMutation.mutateAsync(payload);
    }

    setRuleEditorOpen(false);
  }

  function beginCreatingRule() {
    createRuleMutation.reset();
    updateRuleMutation.reset();
    setEditingRule(null);
    setRuleEditorOpen(true);

    window.setTimeout(() => {
      document
        .getElementById("availability-rule-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  function beginEditingRule(
    rule: AvailabilityRule,
  ) {
    createRuleMutation.reset();
    updateRuleMutation.reset();
    setEditingRule(rule);
    setRuleEditorOpen(true);

    window.setTimeout(() => {
      document
        .getElementById("availability-rule-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  function deleteRule(
    rule: AvailabilityRule,
  ) {
    const confirmed = window.confirm(
      `Delete "${rule.title}"? This may remove `
        + "the related public booking times.",
    );

    if (!confirmed) {
      return;
    }

    deleteRuleMutation.mutate(rule.id);
  }

  const serviceNames = useMemo(
    () =>
      new Map(
        (services ?? []).map((service) => [
          service.id,
          service.name,
        ]),
      ),
    [services],
  );

  const therapistNames = useMemo(
    () =>
      new Map(
        (therapistProfiles ?? []).map((profile) => [
          profile.id,
          profile.full_name,
        ]),
      ),
    [therapistProfiles],
  );

  const showRuleEditor =
    ruleEditorOpen || editingRule !== null;

  const savingRule =
    createRuleMutation.isPending
    || updateRuleMutation.isPending;

  const ruleSaveError =
    createRuleMutation.isError
      ? apiErrorMessage(
          createRuleMutation.error,
          "The weekly schedule could not be created.",
        )
      : updateRuleMutation.isError
        ? apiErrorMessage(
            updateRuleMutation.error,
            "The weekly schedule could not be updated.",
          )
        : null;

  const heading = canManageTeam
    ? "Team Availability"
    : "My Availability";

  const description = canManageTeam
    ? (
        "Manage recurring schedules and one-off "
        + "exceptions across the practice."
      )
    : (
        "Manage working hours and schedule exceptions "
        + "assigned to your therapist profile."
      );

  return (
    <div className="flex flex-col gap-8">
      <header className="order-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {canManageTeam
              ? "Practice scheduling"
              : "Your working schedule"}
          </p>

          <h2 className="text-3xl font-bold text-slate-950">
            {heading}
          </h2>

          <p className="mt-2 text-slate-600">
            {description}
          </p>
        </div>

        {canCreate ? (
          <Button
            type="button"
            onClick={beginCreatingRule}
          >
            + Add availability
          </Button>
        ) : null}
      </header>

      <div className="order-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {canManageTeam
          ? (
              "You are viewing practice-wide availability. "
              + "Changes may affect public booking options "
              + "for any linked therapist."
            )
          : (
              "This page shows only availability linked "
              + "to your therapist profile."
            )}
      </div>

      {showRuleEditor
      && (canCreate || editingRule) ? (
        <div className="order-5">
        <AvailabilityRuleForm
          canManageTeam={canManageTeam}
          editingRule={editingRule}
          services={services ?? []}
          therapistProfiles={
            therapistProfiles ?? []
          }
          saving={savingRule}
          errorMessage={ruleSaveError}
          onSubmit={saveRule}
          onCancelEdit={() => {
            setEditingRule(null);
            setRuleEditorOpen(false);
            createRuleMutation.reset();
            updateRuleMutation.reset();
          }}
        />
        </div>
      ) : null}

      {servicesLoading
      || (canManageTeam && therapistsLoading) ? (
        <p className="order-3 text-sm text-slate-500">
          Loading service and therapist options...
        </p>
      ) : null}

      <section className="order-4">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-950">
            Weekly schedule
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Recurring working hours used to calculate
            bookable dates and times.
          </p>
        </div>

        {rulesLoading || rulesError || !rules?.length ? (
          <DataState
            isLoading={rulesLoading}
            isError={rulesError}
            empty={!rules?.length}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {rules.map((rule) => (
              <AvailabilityRuleCard
                key={rule.id}
                rule={rule}
                serviceName={
                  rule.service_id
                    ? serviceNames.get(rule.service_id)
                    : undefined
                }
                therapistName={
                  canManageTeam
                  && rule.therapist_profile_id
                    ? therapistNames.get(
                        rule.therapist_profile_id,
                      )
                    : undefined
                }
                canEdit={canUpdate}
                canDelete={canDelete}
                deleting={
                  deleteRuleMutation.isPending
                  && deleteRuleMutation.variables
                    === rule.id
                }
                onEdit={() =>
                  beginEditingRule(rule)
                }
                onDelete={() =>
                  deleteRule(rule)
                }
              />
            ))}
          </div>
        )}

        {rulesError ? (
          <p className="mt-3 text-sm text-red-600">
            {apiErrorMessage(
              rulesQueryError,
              "Weekly schedules could not be loaded.",
            )}
          </p>
        ) : null}

        {deleteRuleMutation.isError ? (
          <p className="mt-3 text-sm text-red-600">
            {apiErrorMessage(
              deleteRuleMutation.error,
              "The weekly schedule could not be deleted.",
            )}
          </p>
        ) : null}
      </section>

      <div className="order-6">
      <AvailabilityExceptionManager
        canManageTeam={canManageTeam}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        services={services ?? []}
        therapistProfiles={therapistProfiles ?? []}
        exceptions={exceptions ?? []}
        isLoading={exceptionsLoading}
        isError={exceptionsError}
        queryError={exceptionsQueryError}
      />
      </div>
    </div>
  );
}
