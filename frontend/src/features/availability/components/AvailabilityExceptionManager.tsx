import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isAxiosError } from "axios";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import type { Service } from "../../services/lib/servicesApi";
import type { TherapistProfile } from "../../therapist-profiles/lib/therapistProfilesApi";
import {
  createAvailabilityException,
  createMyAvailabilityException,
  deleteAvailabilityException,
  deleteMyAvailabilityException,
  updateAvailabilityException,
  updateMyAvailabilityException,
} from "../lib/availabilityApi";
import type {
  AvailabilityException,
  AvailabilityExceptionPayload,
  MyAvailabilityExceptionPayload,
} from "../lib/availabilityApi";

const selectClassName =
  "min-w-0 w-full rounded-2xl border border-slate-300 "
  + "bg-white px-4 py-3 text-sm text-slate-950 outline-none "
  + "transition focus:border-slate-900 focus:ring-2 "
  + "focus:ring-slate-200";

type Props = {
  canManageTeam: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  services: Service[];
  therapistProfiles: TherapistProfile[];
  exceptions: AvailabilityException[];
  isLoading: boolean;
  isError: boolean;
  queryError: unknown;
};

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

function ownedExceptionPayload(
  payload: AvailabilityExceptionPayload,
): MyAvailabilityExceptionPayload {
  const owned = {
    ...payload,
  } as Partial<AvailabilityExceptionPayload>;

  delete owned.therapist_profile_id;

  return owned as MyAvailabilityExceptionPayload;
}

function timeInputValue(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function AvailabilityExceptionManager({
  canManageTeam,
  canCreate,
  canUpdate,
  canDelete,
  services,
  therapistProfiles,
  exceptions,
  isLoading,
  isError,
  queryError,
}: Props) {
  const queryClient = useQueryClient();

  const [
    editingException,
    setEditingException,
  ] = useState<AvailabilityException | null>(null);
  const [
    exceptionEditorOpen,
    setExceptionEditorOpen,
  ] = useState(false);

  const [exceptionDate, setExceptionDate] =
    useState("");
  const [exceptionType, setExceptionType] =
    useState<"available" | "blocked">("blocked");
  const [wholeDay, setWholeDay] = useState(true);
  const [startTime, setStartTime] =
    useState("09:00");
  const [endTime, setEndTime] =
    useState("17:00");
  const [reason, setReason] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [
    therapistProfileId,
    setTherapistProfileId,
  ] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [localError, setLocalError] = useState("");

  function resetForm() {
    setEditingException(null);
    setExceptionDate("");
    setExceptionType("blocked");
    setWholeDay(true);
    setStartTime("09:00");
    setEndTime("17:00");
    setReason("");
    setServiceId("");
    setTherapistProfileId("");
    setIsActive(true);
    setIsPublic(true);
    setLocalError("");
    setExceptionEditorOpen(false);
  }

  useEffect(() => {
    if (!editingException) {
      return;
    }

    const hasTimeWindow = Boolean(
      editingException.start_time
      && editingException.end_time,
    );

    setExceptionDate(editingException.date);
    setExceptionType(
      editingException.exception_type,
    );
    setWholeDay(!hasTimeWindow);
    setStartTime(
      timeInputValue(editingException.start_time)
      || "09:00",
    );
    setEndTime(
      timeInputValue(editingException.end_time)
      || "17:00",
    );
    setReason(editingException.reason ?? "");
    setServiceId(
      editingException.service_id ?? "",
    );
    setTherapistProfileId(
      editingException.therapist_profile_id ?? "",
    );
    setIsActive(editingException.is_active);
    setIsPublic(editingException.is_public);
    setLocalError("");
  }, [editingException]);

  function invalidateExceptions() {
    void queryClient.invalidateQueries({
      queryKey: ["availability-exceptions"],
    });
  }

  const createMutation = useMutation({
    mutationFn: (
      payload: AvailabilityExceptionPayload,
    ) =>
      canManageTeam
        ? createAvailabilityException(payload)
        : createMyAvailabilityException(
            ownedExceptionPayload(payload),
          ),
    onSuccess: () => {
      resetForm();
      invalidateExceptions();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: AvailabilityExceptionPayload;
    }) =>
      canManageTeam
        ? updateAvailabilityException({
            id,
            data,
          })
        : updateMyAvailabilityException({
            id,
            data: ownedExceptionPayload(data),
          }),
    onSuccess: () => {
      resetForm();
      invalidateExceptions();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      canManageTeam
        ? deleteAvailabilityException(id)
        : deleteMyAvailabilityException(id),
    onSuccess: () => {
      resetForm();
      invalidateExceptions();
    },
  });

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setLocalError("");

    if (!exceptionDate) {
      setLocalError(
        "Choose the date this exception applies to.",
      );
      return;
    }

    if (!wholeDay) {
      if (!startTime || !endTime) {
        setLocalError(
          "Choose both a start time and an end time.",
        );
        return;
      }

      if (endTime <= startTime) {
        setLocalError(
          "The end time must be after the start time.",
        );
        return;
      }
    }

    if (canManageTeam && !therapistProfileId) {
      setLocalError(
        "Choose the therapist this exception belongs to.",
      );
      return;
    }

    const payload: AvailabilityExceptionPayload = {
      date: exceptionDate,
      start_time: wholeDay ? null : startTime,
      end_time: wholeDay ? null : endTime,
      exception_type: exceptionType,
      reason: reason.trim() || null,
      service_id: serviceId || null,
      therapist_profile_id: canManageTeam
        ? therapistProfileId || null
        : null,
      is_active: isActive,
      is_public: isPublic,
    };

    try {
      if (editingException) {
        await updateMutation.mutateAsync({
          id: editingException.id,
          data: payload,
        });
        return;
      }

      await createMutation.mutateAsync(payload);
    } catch {
      // Mutation errors are displayed below the form.
    }
  }

  function beginCreateException() {
    resetForm();
    setExceptionEditorOpen(true);

    window.setTimeout(() => {
      document
        .getElementById(
          "availability-exception-form",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  function beginEdit(
    exception: AvailabilityException,
  ) {
    createMutation.reset();
    updateMutation.reset();
    setEditingException(exception);
    setExceptionEditorOpen(true);

    window.setTimeout(() => {
      document
        .getElementById(
          "availability-exception-form",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  function removeException(
    exception: AvailabilityException,
  ) {
    const label =
      exception.exception_type === "blocked"
        ? "blocked time"
        : "extra availability";

    const confirmed = window.confirm(
      `Delete this ${label} on `
      + `${exception.date}?`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(exception.id);
  }

  const serviceNames = useMemo(
    () =>
      new Map(
        services.map((service) => [
          service.id,
          service.name,
        ]),
      ),
    [services],
  );

  const therapistNames = useMemo(
    () =>
      new Map(
        therapistProfiles.map((profile) => [
          profile.id,
          profile.full_name,
        ]),
      ),
    [therapistProfiles],
  );

  const showEditor =
    exceptionEditorOpen
    || editingException !== null;

  const saving =
    createMutation.isPending
    || updateMutation.isPending;

  const saveError =
    createMutation.isError
      ? apiErrorMessage(
          createMutation.error,
          "The schedule exception could not be created.",
        )
      : updateMutation.isError
        ? apiErrorMessage(
            updateMutation.error,
            "The schedule exception could not be updated.",
          )
        : null;

  return (
    <section className="flex flex-col gap-5">
      {showEditor
      && (canCreate || editingException) ? (
        <form
          id="availability-exception-form"
          onSubmit={handleSubmit}
          className="order-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                One-off schedule change
              </p>

              <h3 className="text-xl font-bold text-slate-950">
                {editingException
                  ? "Edit schedule exception"
                  : "Block a date or add extra hours"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Use blocked time for leave, closures or
                unavailable hours. Use extra availability
                to open time outside the weekly schedule.
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
            >
              {editingException
                ? "Cancel edit"
                : "Cancel"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Date"
              type="date"
              value={exceptionDate}
              onChange={(event) =>
                setExceptionDate(event.target.value)
              }
              className="bg-white text-slate-950"
              required
            />

            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Exception type
              </span>

              <select
                value={exceptionType}
                onChange={(event) =>
                  setExceptionType(
                    event.target.value as
                      | "available"
                      | "blocked",
                  )
                }
                className={selectClassName}
              >
                <option value="blocked">
                  Block time
                </option>
                <option value="available">
                  Add extra availability
                </option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={wholeDay}
                onChange={(event) =>
                  setWholeDay(event.target.checked)
                }
              />
              Apply to the whole day
            </label>

            {!wholeDay ? (
              <>
                <Input
                  label="Start time"
                  type="time"
                  value={startTime}
                  onChange={(event) =>
                    setStartTime(event.target.value)
                  }
                  className="bg-white text-slate-950"
                  required
                />

                <Input
                  label="End time"
                  type="time"
                  value={endTime}
                  onChange={(event) =>
                    setEndTime(event.target.value)
                  }
                  className="bg-white text-slate-950"
                  required
                />
              </>
            ) : null}

            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Service
              </span>

              <select
                value={serviceId}
                onChange={(event) =>
                  setServiceId(event.target.value)
                }
                className={selectClassName}
              >
                <option value="">
                  All eligible services
                </option>

                {services.map((service) => (
                  <option
                    key={service.id}
                    value={service.id}
                  >
                    {service.name}
                  </option>
                ))}
              </select>
            </label>

            {canManageTeam ? (
              <label className="block min-w-0 space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Therapist
                </span>

                <select
                  value={therapistProfileId}
                  onChange={(event) =>
                    setTherapistProfileId(
                      event.target.value,
                    )
                  }
                  className={selectClassName}
                  required
                >
                  <option value="">
                    Choose a therapist
                  </option>

                  {therapistProfiles.map(
                    (profile) => (
                      <option
                        key={profile.id}
                        value={profile.id}
                      >
                        {profile.full_name}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-4">
            <Textarea
              label="Reason or internal note"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder="Annual leave, public holiday or additional evening hours"
              className="text-slate-950"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(event.target.checked)
                }
              />
              Active
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) =>
                  setIsPublic(event.target.checked)
                }
              />
              Apply to public booking
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingException
                  ? "Save exception changes"
                  : exceptionType === "blocked"
                    ? "Block this time"
                    : "Add extra availability"}
            </Button>
          </div>

          {localError ? (
            <p className="mt-3 text-sm text-red-600">
              {localError}
            </p>
          ) : null}

          {saveError ? (
            <p className="mt-3 text-sm text-red-600">
              {saveError}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Schedule exceptions / off days
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Block time off or add availability outside the
              recurring weekly schedule.
            </p>
          </div>

          {canCreate ? (
            <Button
              type="button"
              onClick={beginCreateException}
            >
              + Add exception
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          {isLoading || isError || !exceptions.length ? (
            <DataState
              isLoading={isLoading}
              isError={isError}
              empty={!exceptions.length}
            />
          ) : (
            <div className="grid gap-3">
              {exceptions.map((exception) => {
                const hasWindow = Boolean(
                  exception.start_time
                  && exception.end_time,
                );

                return (
                  <article
                    key={exception.id}
                    className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {exception.date}
                        </p>

                        <p className="mt-1">
                          {exception.exception_type
                            === "blocked"
                            ? "Blocked time"
                            : "Extra availability"}
                        </p>

                        {canManageTeam
                        && exception.therapist_profile_id ? (
                          <p className="mt-1 text-slate-500">
                            {therapistNames.get(
                              exception
                                .therapist_profile_id,
                            ) || "Unknown therapist"}
                          </p>
                        ) : null}
                      </div>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {hasWindow
                          ? (
                              `${exception.start_time
                                ?.slice(0, 5)} to `
                              + `${exception.end_time
                                ?.slice(0, 5)}`
                            )
                          : "Whole day"}
                      </span>
                    </div>

                    {exception.service_id ? (
                      <p className="mt-3">
                        Service:{" "}
                        {serviceNames.get(
                          exception.service_id,
                        ) || "Unknown service"}
                      </p>
                    ) : (
                      <p className="mt-3">
                        Applies to all services
                      </p>
                    )}

                    {exception.reason ? (
                      <p className="mt-2">
                        {exception.reason}
                      </p>
                    ) : null}

                    <p className="mt-3 text-xs text-slate-500">
                      Public:{" "}
                      {exception.is_public
                        ? "Yes"
                        : "No"}
                      {" · "}
                      Active:{" "}
                      {exception.is_active
                        ? "Yes"
                        : "No"}
                    </p>

                    {canUpdate || canDelete ? (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                        {canUpdate ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              beginEdit(exception)
                            }
                          >
                            Edit
                          </Button>
                        ) : null}

                        {canDelete ? (
                          <Button
                            type="button"
                            variant="danger"
                            disabled={
                              deleteMutation.isPending
                            }
                            onClick={() =>
                              removeException(exception)
                            }
                          >
                            {deleteMutation.isPending
                            && deleteMutation.variables
                              === exception.id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {isError ? (
          <p className="mt-3 text-sm text-red-600">
            {apiErrorMessage(
              queryError,
              "Schedule exceptions could not be loaded.",
            )}
          </p>
        ) : null}

        {deleteMutation.isError ? (
          <p className="mt-3 text-sm text-red-600">
            {apiErrorMessage(
              deleteMutation.error,
              "The schedule exception could not be deleted.",
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}
