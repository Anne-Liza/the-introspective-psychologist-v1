import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { Input } from "../../../components/ui/Input";
import { ManagedImageAssetPicker } from "../../files/components/ManagedImageAssetPicker";
import { apiClient } from "../../../lib/api-client";

type LandingSection = {
  id: string;
  key: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_asset_id: string | null;
  sort_order: number;
  is_visible: boolean;
};

type SectionPayload = {
  key: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_asset_id: string | null;
  sort_order: number;
  is_visible: boolean;
};

const emptyForm = {
  key: "home.hero",
  title: "",
  eyebrow: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  imageAssetId: null as string | null,
  sortOrder: "1",
  isVisible: true,
};

async function fetchSections() {
  const response = await apiClient.get<LandingSection[]>("/landing-sections");
  return response.data;
}

async function createSection(payload: SectionPayload) {
  const response = await apiClient.post<LandingSection>("/landing-sections", payload);
  return response.data;
}

async function updateSection(payload: { id: string; data: Partial<SectionPayload> }) {
  const response = await apiClient.patch<LandingSection>(`/landing-sections/${payload.id}`, payload.data);
  return response.data;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pageLabel(key: string) {
  if (key.startsWith("home.")) return "Home";
  if (key.startsWith("about.")) return "About";
  return "Other";
}

export function ContentPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["landing-sections"],
    queryFn: fetchSections,
  });

  const createMutation = useMutation({
    mutationFn: createSection,
    onSuccess: () => {
      setForm(emptyForm);
      queryClient.invalidateQueries({
        queryKey: ["landing-sections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-media"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-landing-sections"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSection,
    onSuccess: () => {
      setEditingId(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({
        queryKey: ["landing-sections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-media"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-landing-sections"],
      });
    },
  });

  function buildPayload(): SectionPayload {
    return {
      key: form.key.trim(),
      title: form.title.trim(),
      eyebrow: nullable(form.eyebrow),
      body: nullable(form.body),
      cta_label: nullable(form.ctaLabel),
      cta_url: nullable(form.ctaUrl),
      image_url: form.imageAssetId
        ? null
        : nullable(form.imageUrl),
      image_asset_id: form.imageAssetId,
      sort_order: Number(form.sortOrder) || 0,
      is_visible: form.isVisible,
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload();

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
      return;
    }

    createMutation.mutate(payload);
  }

  function editSection(section: LandingSection) {
    setEditingId(section.id);
    setForm({
      key: section.key,
      title: section.title,
      eyebrow: section.eyebrow ?? "",
      body: section.body ?? "",
      ctaLabel: section.cta_label ?? "",
      ctaUrl: section.cta_url ?? "",
      imageUrl: section.image_url ?? "",
      imageAssetId: section.image_asset_id,
      sortOrder: String(section.sort_order),
      isVisible: section.is_visible,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  const showState = isLoading || isError || !data?.length;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Public website</p>
        <h2 className="text-3xl font-bold">Content Sections</h2>
        <p className="mt-2 text-slate-600">
          Edit reusable Home and About page sections using structured content keys.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{editingId ? "Edit section" : "Create section"}</h3>
          {editingId ? (
            <Button type="button" onClick={cancelEdit}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Section key" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} required />
          <Input label="Sort order" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
          <Input label="Eyebrow" value={form.eyebrow} onChange={(event) => setForm({ ...form, eyebrow: event.target.value })} />
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input label="CTA label" value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} />
          <Input label="CTA URL" value={form.ctaUrl} onChange={(event) => setForm({ ...form, ctaUrl: event.target.value })} />
          <ManagedImageAssetPicker
            label="Section image"
            purpose="landing_section_image"
            selectedAssetId={
              form.imageAssetId
            }
            legacyUrl={
              form.imageUrl || null
            }
            scope="admin"
            disabled={isSaving}
            onChange={(assetId) =>
              setForm({
                ...form,
                imageAssetId: assetId,
                imageUrl: "",
              })
            }
          />
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-medium text-slate-700">Body</span>
          <textarea
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            className="min-h-32 w-full rounded-2xl border px-4 py-3 text-sm"
          />
        </label>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.isVisible}
            onChange={(event) => setForm({ ...form, isVisible: event.target.checked })}
          />
          Visible on public site
        </label>

        <div className="mt-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Save changes" : "Create section"}
          </Button>
        </div>
      </form>

      {showState ? (
        <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Section</th>
                <th className="p-4">Page</th>
                <th className="p-4">Status</th>
                <th className="p-4">Order</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((section) => (
                <tr key={section.id} className="border-t">
                  <td className="p-4">
                    <div className="font-medium">{section.title}</div>
                    <div className="text-xs text-slate-500">{section.key}</div>
                  </td>
                  <td className="p-4">{pageLabel(section.key)}</td>
                  <td className="p-4">{section.is_visible ? "Visible" : "Hidden"}</td>
                  <td className="p-4">{section.sort_order}</td>
                  <td className="p-4">
                    <Button type="button" onClick={() => editSection(section)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
