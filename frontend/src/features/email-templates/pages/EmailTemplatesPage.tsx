import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { PageHeader } from "../../../components/data/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { apiClient } from "../../../lib/api-client";

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  description?: string | null;
  is_active: boolean;
};

type Drafts = Record<string, EmailTemplate>;

const COMMON_PLACEHOLDERS = [
  "{{site_name}}",
  "{{client_name}}",
  "{{appointment_date}}",
  "{{payment_amount}}",
  "{{receipt_number}}",
  "{{reset_link}}",
  "{{verification_link}}",
];

async function fetchTemplates() {
  const response = await apiClient.get<EmailTemplate[]>("/email-templates");
  return response.data;
}

async function updateTemplate(payload: EmailTemplate) {
  const response = await apiClient.patch<EmailTemplate>(`/email-templates/${payload.id}`, {
    name: payload.name,
    subject: payload.subject,
    body: payload.body,
    description: payload.description,
    is_active: payload.is_active,
  });
  return response.data;
}

export function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["email-templates"],
    queryFn: fetchTemplates,
  });

  const mutation = useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
  });

  const templates = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;

    const query = search.toLowerCase();
    return data.filter((template) =>
      [template.key, template.name, template.subject, template.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data, search]);

  const isEmpty = Array.isArray(data) && data.length === 0;

  function updateDraft(id: string, nextDraft: EmailTemplate) {
    setDrafts((current) => ({ ...current, [id]: nextDraft }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Email Templates"
        description="Customize plain-text transactional emails for this generated app. Keep templates clear, branded, and safe."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Templates</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{data?.length ?? "—"}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {data?.filter((template) => template.is_active).length ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Format</p>
          <p className="mt-2 text-lg font-bold text-slate-950">Plain text only</p>
        </div>
      </section>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold">Allowed placeholder examples</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Use placeholders only when the sending workflow provides them. Unknown placeholders remain visible in the email.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {COMMON_PLACEHOLDERS.map((placeholder) => (
            <span key={placeholder} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {placeholder}
            </span>
          ))}
        </div>
      </div>

      <Input
        label="Search templates"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by key, name, subject, or description"
      />

      <DataState isLoading={isLoading} isError={isError} empty={isEmpty} />

      {!isLoading && !isError && templates.length ? (
        <div className="space-y-4">
          {templates.map((template) => {
            const draft = drafts[template.id] ?? template;

            return (
              <article key={template.id} className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {template.key}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-950">{draft.name}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {draft.description || "Transactional email template."}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    {draft.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4">
                  <Input
                    label="Template name"
                    value={draft.name}
                    onChange={(event) => updateDraft(template.id, { ...draft, name: event.target.value })}
                  />

                  <Input
                    label="Subject"
                    value={draft.subject}
                    onChange={(event) => updateDraft(template.id, { ...draft, subject: event.target.value })}
                  />

                  <Textarea
                    label="Body"
                    value={draft.body}
                    onChange={(event) => updateDraft(template.id, { ...draft, body: event.target.value })}
                  />

                  <Textarea
                    label="Admin description"
                    value={draft.description ?? ""}
                    onChange={(event) => updateDraft(template.id, { ...draft, description: event.target.value })}
                  />

                  <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => updateDraft(template.id, { ...draft, is_active: event.target.checked })}
                    />
                    Active template
                  </label>

                  <details className="rounded-2xl border bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-bold text-slate-950">
                      Preview email
                    </summary>
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Subject</p>
                      <p className="mt-2 font-semibold text-slate-950">{draft.subject || "No subject yet"}</p>

                      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Body</p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                        {draft.body || "No body yet"}
                      </pre>
                    </div>
                  </details>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => mutation.mutate(draft)}
                      disabled={mutation.isPending || !draft.subject.trim() || !draft.body.trim()}
                    >
                      Save template
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
