import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { JsonPreview } from "../../../components/data/JsonPreview";
import { PageHeader } from "../../../components/data/PageHeader";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";

type UnknownRecord = Record<string, unknown>;

async function fetchData() {
  const response = await apiClient.get<unknown>("/email/logs");
  return response.data;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function pickValue(item: unknown, keys: string[], fallback: string) {
  const record = asRecord(item);

  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function formatDate(value: string) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function EmailLogsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/email/logs"],
    queryFn: fetchData,
  });

  const logs = asArray(data);
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;

    const query = search.toLowerCase();
    return logs.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
  }, [logs, search]);

  const isEmpty = Array.isArray(data) && data.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Messaging"
        title="Email Logs"
        description="Review transactional email activity from SMTP, Mailpit, invitations, and system notifications."
      />

      {!isLoading && !isError ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Total logs</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {Array.isArray(data) ? data.length : "—"}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Visible results</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{filteredLogs.length}</p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Source</p>
            <p className="mt-2 text-lg font-bold text-slate-950">/email/logs</p>
          </div>
        </section>
      ) : null}

      <Input
        label="Search email logs"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by recipient, subject, status, or provider"
      />

      <DataState isLoading={isLoading} isError={isError} empty={isEmpty} />

      {!isLoading && !isError && isEmpty ? (
        <div className="rounded-3xl border border-dashed bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">No email logs yet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Transactional email records will appear here after the app sends messages.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && filteredLogs.length ? (
        <section className="grid gap-4">
          {filteredLogs.map((log, index) => (
            <article key={index} className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {pickValue(log, ["status", "delivery_status", "state"], "Email event")}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    {pickValue(log, ["subject", "template_key", "event_type"], `Email ${index + 1}`)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    To: {pickValue(log, ["to_email", "recipient", "email", "to"], "Unknown recipient")}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {formatDate(pickValue(log, ["created_at", "sent_at", "timestamp"], "—"))}
                </span>
              </div>

              <details className="mt-5 rounded-2xl border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-950">
                  View raw email log
                </summary>
                <div className="mt-4">
                  <JsonPreview data={log} />
                </div>
              </details>
            </article>
          ))}
        </section>
      ) : null}

      {!isLoading && !isError && !Array.isArray(data) && data ? (
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-950">Email payload</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The endpoint returned a non-list payload. Keeping the raw response visible for developer
            review.
          </p>
          <div className="mt-5">
            <JsonPreview data={data} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
