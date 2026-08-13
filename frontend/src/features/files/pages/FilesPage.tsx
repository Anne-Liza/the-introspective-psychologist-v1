import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { PageHeader } from "../../../components/data/PageHeader";
import { apiClient, resolveApiAssetUrl } from "../../../lib/api-client";

type FileAsset = {
  id: string;
  original_filename: string;
  stored_filename: string;
  content_type: string | null;
  size_bytes: number;
  storage_provider: string;
  storage_path: string;
  public_url: string | null;
  created_at?: string;
};

async function fetchFiles() {
  const response = await apiClient.get<FileAsset[]>("/files");
  return response.data;
}

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("upload", file);
  const response = await apiClient.post<FileAsset>("/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

async function deleteFile(id: string) {
  await apiClient.delete(`/files/${id}`);
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function isImage(file: FileAsset) {
  return file.content_type?.startsWith("image/");
}

function fileUrl(file: FileAsset) {
  return file.public_url ? resolveApiAssetUrl(file.public_url) : file.storage_path;
}

export function FilesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["files"],
    queryFn: fetchFiles,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files"] }),
  });

  const imageCount = useMemo(() => data?.filter(isImage).length ?? 0, [data]);
  const documentCount = useMemo(() => (data?.length ?? 0) - imageCount, [data]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (file) uploadMutation.mutate(file);
  }

  async function handleCopy(fileAsset: FileAsset) {
    const value = fileUrl(fileAsset);
    await navigator.clipboard.writeText(value);
    setCopiedFileId(fileAsset.id);
    window.setTimeout(() => setCopiedFileId(null), 1500);
  }

  const showState = isLoading || isError || !data?.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core assets"
        title="Media Library"
        description="Upload, preview, copy, and manage reusable files for this app."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total files</p>
          <p className="mt-2 text-2xl font-bold">{data?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Images</p>
          <p className="mt-2 text-2xl font-bold">{imageCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Documents / other</p>
          <p className="mt-2 text-2xl font-bold">{documentCount}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Choose a file</span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border px-4 py-3 text-sm"
            />
          </label>
          <Button type="submit" disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Uploading..." : "Upload file"}
          </Button>
        </div>

        {file ? (
          <p className="mt-3 text-sm text-slate-600">
            Selected: {file.name} · {formatSize(file.size)}
          </p>
        ) : null}

        {uploadMutation.isError ? <p className="mt-3 text-sm text-red-600">Upload failed. Check file type and size.</p> : null}
        {uploadMutation.isSuccess ? <p className="mt-3 text-sm text-green-700">File uploaded successfully.</p> : null}
      </form>

      {showState ? (
        <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex h-44 items-center justify-center bg-slate-100">
                {isImage(item) ? (
                  <img
                    src={fileUrl(item)}
                    alt={item.original_filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-600">
                    {item.content_type || "File"}
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h3 className="break-words font-semibold">{item.original_filename}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.content_type || "Unknown type"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Size</p>
                    <p className="font-medium">{formatSize(item.size_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Provider</p>
                    <p className="font-medium">{item.storage_provider}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">Uploaded</p>
                    <p className="font-medium">{formatDate(item.created_at)}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-1 font-medium text-slate-700">URL / path</p>
                  <p className="break-all">{fileUrl(item)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => handleCopy(item)}>
                    {copiedFileId === item.id ? "Copied" : "Copy URL"}
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
