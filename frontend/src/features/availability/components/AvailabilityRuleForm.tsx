import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { Service } from "../../services/lib/servicesApi";
import type { TherapistProfile } from "../../therapist-profiles/lib/therapistProfilesApi";
import type {
  AvailabilityRule,
  AvailabilityRulePayload,
} from "../lib/availabilityApi";

const DAY_OPTIONS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const selectClassName =
  "min-w-0 w-full rounded-2xl border border-slate-300 "
  + "bg-white px-4 py-3 text-sm text-slate-950 outline-none "
  + "transition focus:border-slate-900 focus:ring-2 "
  + "focus:ring-slate-200";

type Props = {
  canManageTeam: boolean;
  editingRule: AvailabilityRule | null;
  services: Service[];
  therapistProfiles: TherapistProfile[];
  saving: boolean;
  errorMessage?: string | null;
  onSubmit: (
    payloads: AvailabilityRulePayload[],
  ) => Promise<void>;
  onCancelEdit: () => void;
};

function timeInputValue(value: string) {
  return value.slice(0, 5);
}

export function AvailabilityRuleForm({
  canManageTeam,
  editingRule,
  services,
  therapistProfiles,
  saving,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] =
    useState<number[]>([0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState(
    "Africa/Nairobi",
  );
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [capacity, setCapacity] = useState(1);
  const [serviceId, setServiceId] = useState("");
  const [
    therapistProfileId,
    setTherapistProfileId,
  ] = useState("");
  const [selectedFormats, setSelectedFormats] =
    useState<string[]>(["Online"]);
  const [location, setLocation] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [localError, setLocalError] = useState("");

  function resetForm() {
    setTitle("");
    setSelectedDays([0]);
    setStartTime("09:00");
    setEndTime("17:00");
    setTimezone("Africa/Nairobi");
    setSlotDuration(60);
    setBufferMinutes(10);
    setCapacity(1);
    setServiceId("");
    setTherapistProfileId("");
    setSelectedFormats(["Online"]);
    setLocation("");
    setSortOrder(0);
    setIsActive(true);
    setIsPublic(true);
    setLocalError("");
  }

  useEffect(() => {
    if (!editingRule) {
      return;
    }

    setTitle(editingRule.title);
    setSelectedDays([editingRule.day_of_week]);
    setStartTime(
      timeInputValue(editingRule.start_time),
    );
    setEndTime(
      timeInputValue(editingRule.end_time),
    );
    setTimezone(editingRule.timezone);
    const linkedService = services.find(
      (service) =>
        service.id === editingRule.service_id,
    );

    setSlotDuration(
      linkedService?.duration_minutes
        ?? editingRule.slot_duration_minutes,
    );
    setBufferMinutes(editingRule.buffer_minutes);
    setCapacity(editingRule.capacity);
    setServiceId(editingRule.service_id ?? "");
    setTherapistProfileId(
      editingRule.therapist_profile_id ?? "",
    );
    setSelectedFormats([
      editingRule.session_format || "Online",
    ]);
    setLocation(editingRule.location ?? "");
    setSortOrder(editingRule.sort_order);
    setIsActive(editingRule.is_active);
    setIsPublic(editingRule.is_public);
    setLocalError("");
  }, [editingRule, services]);

  function cancelEdit() {
    resetForm();
    onCancelEdit();
  }

  const selectedService = services.find(
    (service) => service.id === serviceId,
  );

  function toggleDay(day: number) {
    if (editingRule) {
      setSelectedDays([day]);
      return;
    }

    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  }

  function toggleFormat(format: string) {
    if (editingRule) {
      setSelectedFormats([format]);
      return;
    }

    setSelectedFormats((current) =>
      current.includes(format)
        ? current.filter((value) => value !== format)
        : [...current, format],
    );
  }

  function handleServiceChange(nextId: string) {
    setServiceId(nextId);

    const service = services.find(
      (item) => item.id === nextId,
    );

    if (service?.duration_minutes) {
      setSlotDuration(service.duration_minutes);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setLocalError("");

    if (!title.trim()) {
      setLocalError("Enter a schedule title.");
      return;
    }

    if (!selectedDays.length) {
      setLocalError(
        "Choose at least one available day.",
      );
      return;
    }

    if (!selectedFormats.length) {
      setLocalError(
        "Choose at least one session format.",
      );
      return;
    }

    if (
      selectedFormats.includes("In person")
      && !location.trim()
    ) {
      setLocalError(
        "Add a location for in-person sessions.",
      );
      return;
    }

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

    if (slotDuration <= 0) {
      setLocalError(
        "Session duration must be greater than zero.",
      );
      return;
    }

    if (bufferMinutes < 0) {
      setLocalError(
        "Buffer time cannot be negative.",
      );
      return;
    }

    if (canManageTeam && !therapistProfileId) {
      setLocalError(
        "Choose the therapist who owns this schedule.",
      );
      return;
    }

    const common = {
      title: title.trim(),
      start_time: startTime,
      end_time: endTime,
      timezone: timezone.trim(),
      slot_duration_minutes: slotDuration,
      buffer_minutes: bufferMinutes,
      capacity,
      service_id: serviceId || null,
      therapist_profile_id: canManageTeam
        ? therapistProfileId || null
        : null,
      is_active: isActive,
      is_public: isPublic,
      sort_order: sortOrder,
    };

    const payloads: AvailabilityRulePayload[] =
      selectedDays.flatMap((day) =>
        selectedFormats.map((format) => ({
          ...common,
          day_of_week: day,
          session_format: format,
          location:
            format === "In person"
              ? location.trim()
              : null,
        })),
      );

    try {
      await onSubmit(payloads);
      resetForm();
    } catch {
      // The parent mutation exposes the API error below.
    }
  }

  return (
    <form
      id="availability-rule-form"
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Recurring working hours
          </p>

          <h3 className="text-xl font-bold text-slate-950">
            {editingRule
              ? "Edit weekly schedule"
              : "Add availability"}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            These hours are used to calculate public
            booking dates and times.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={cancelEdit}
        >
          {editingRule ? "Cancel edit" : "Cancel"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Schedule title"
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder="Monday morning sessions"
          className="bg-white text-slate-950"
          required
        />

        <div className="md:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Days available
          </span>

          <div className="mt-2 flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => (
              <label
                key={day.value}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(
                    day.value,
                  )}
                  onChange={() =>
                    toggleDay(day.value)
                  }
                />
                {day.label}
              </label>
            ))}
          </div>

          {editingRule ? (
            <p className="mt-2 text-xs text-slate-500">
              Editing changes one existing schedule rule.
            </p>
          ) : null}
        </div>

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

        <div>
          <Input
            label="Session duration in minutes"
            type="number"
            min={1}
            value={slotDuration}
            onChange={(event) =>
              setSlotDuration(
                Number(event.target.value),
              )
            }
            className="bg-white text-slate-950"
            disabled={Boolean(
              selectedService?.duration_minutes,
            )}
            required
          />

          {selectedService?.duration_minutes ? (
            <p className="mt-2 text-xs text-slate-500">
              Inherited from the selected service.
            </p>
          ) : null}
        </div>

        <Input
          label="Buffer between sessions"
          type="number"
          min={0}
          value={bufferMinutes}
          onChange={(event) =>
            setBufferMinutes(
              Number(event.target.value),
            )
          }
          className="bg-white text-slate-950"
          required
        />

        <div>
          <span className="text-sm font-medium text-slate-700">
            Session formats
          </span>

          <div className="mt-2 flex flex-wrap gap-2">
            {["Online", "In person"].map((format) => (
              <label
                key={format}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedFormats.includes(
                    format,
                  )}
                  onChange={() =>
                    toggleFormat(format)
                  }
                />
                {format}
              </label>
            ))}
          </div>
        </div>

        {selectedFormats.includes("In person") ? (
          <Input
            label="In-person location"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            placeholder="Practice address or room"
            className="bg-white text-slate-950"
            required
          />
        ) : (
          <div />
        )}

        <label className="block min-w-0 space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Service
          </span>

          <select
            value={serviceId}
            onChange={(event) =>
              handleServiceChange(
                event.target.value,
              )
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

              {therapistProfiles.map((profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                >
                  {profile.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <Input
          label="Timezone"
          value={timezone}
          onChange={(event) =>
            setTimezone(event.target.value)
          }
          className="bg-white text-slate-950"
          required
        />

        <Input
          label="Display order"
          type="number"
          value={sortOrder}
          onChange={(event) =>
            setSortOrder(Number(event.target.value))
          }
          className="bg-white text-slate-950"
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
          Available for public booking
        </label>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Individual appointment capacity remains fixed at
        one. Group-session capacity will be handled as a
        separate booking feature.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : editingRule
              ? "Save schedule changes"
              : "Add weekly schedule"}
        </Button>
      </div>

      {localError ? (
        <p className="mt-3 text-sm text-red-600">
          {localError}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
