import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { PageHeader } from "../../../components/data/PageHeader";

import { AssetImage } from "../components/AssetImage";

import {
  deleteMyFile,
  fetchMyFiles,
  type FileAsset,
  type FilePurpose,
  uploadMyFile,
} from "../lib/filesApi";


type MediaFilter =
  | "all"
  | "profile"
  | "articles"
  | "other";


const PURPOSE_OPTIONS: Array<{
  value: FilePurpose;
  label: string;
  description: string;
}> = [
  {
    value:
      "therapist_profile_image",
    label: "Profile image",
    description:
      "Portrait or professional profile image.",
  },
  {
    value: "blog_cover_image",
    label: "Article cover",
    description:
      "Cover image for an article.",
  },
  {
    value: "blog_inline_image",
    label: "Article image",
    description:
      "Image used inside an article.",
  },
  {
    value: "general",
    label: "General file",
    description:
      "A personal working asset.",
  },
];


function formatSize(
  size: number,
) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${Math.round(
      size / 1024,
    )} KB`;
  }

  return `${(
    size /
    1024 /
    1024
  ).toFixed(1)} MB`;
}


function formatDate(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleDateString();
}


function isImage(
  asset: FileAsset,
) {
  return (
    asset.content_type?.startsWith(
      "image/",
    ) ?? false
  );
}


function purposeLabel(
  purpose: FilePurpose,
) {
  const option =
    PURPOSE_OPTIONS.find(
      (item) =>
        item.value === purpose,
    );

  return (
    option?.label ??
    purpose.replace(
      /_/g,
      " ",
    )
  );
}


function visibilityLabel(
  value: FileAsset["visibility"],
) {
  if (value === "public") {
    return "Public";
  }

  if (value === "private") {
    return "Private";
  }

  return "Internal";
}


export function MyMediaPage() {
  const queryClient =
    useQueryClient();

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [purpose, setPurpose] =
    useState<FilePurpose>(
      "therapist_profile_image",
    );

  const [filter, setFilter] =
    useState<MediaFilter>("all");

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "my-media",
    ],
    queryFn: fetchMyFiles,
  });

  const uploadMutation =
    useMutation({
      mutationFn: () => {
        if (!selectedFile) {
          throw new Error(
            "Choose a file first.",
          );
        }

        return uploadMyFile(
          selectedFile,
          purpose,
        );
      },
      onSuccess: () => {
        setSelectedFile(null);

        queryClient.invalidateQueries({
          queryKey: [
            "my-media",
          ],
        });
      },
    });

  const deleteMutation =
    useMutation({
      mutationFn: deleteMyFile,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "my-media",
          ],
        });
      },
    });

  const filtered =
    useMemo(() => {
      const files =
        data ?? [];

      if (
        filter === "profile"
      ) {
        return files.filter(
          (item) =>
            item.purpose ===
            "therapist_profile_image",
        );
      }

      if (
        filter === "articles"
      ) {
        return files.filter(
          (item) =>
            item.purpose ===
              "blog_cover_image" ||
            item.purpose ===
              "blog_inline_image",
        );
      }

      if (
        filter === "other"
      ) {
        return files.filter(
          (item) =>
            ![
              "therapist_profile_image",
              "blog_cover_image",
              "blog_inline_image",
            ].includes(
              item.purpose,
            ),
        );
      }

      return files;
    }, [
      data,
      filter,
    ]);

  const imageCount =
    useMemo(
      () =>
        (data ?? []).filter(
          isImage,
        ).length,
      [data],
    );

  function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!selectedFile) {
      return;
    }

    uploadMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice"
        title="My Media"
        description="Upload and manage your own profile and article media. Your private working assets are not exposed publicly until the content using them is published."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            My files
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.length ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Images
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {imageCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            In use
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              (data ?? []).filter(
                (item) =>
                  item.usage_count > 0,
              ).length
            }
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Upload media
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose what the file will be used for. Profile and article image uploads must be JPG, PNG, or WebP.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              File
            </span>

            <input
              type="file"
              onChange={(event) =>
                setSelectedFile(
                  event.target.files?.[0] ??
                    null,
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Use
            </span>

            <select
              value={purpose}
              onChange={(event) =>
                setPurpose(
                  event.target
                    .value as FilePurpose,
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {PURPOSE_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {
                      option.label
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <Button
            type="submit"
            disabled={
              !selectedFile ||
              uploadMutation.isPending
            }
          >
            {uploadMutation.isPending
              ? "Uploading..."
              : "Upload"}
          </Button>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {
            PURPOSE_OPTIONS.find(
              (item) =>
                item.value ===
                purpose,
            )?.description
          }
        </p>

        {selectedFile ? (
          <p className="mt-2 text-sm text-slate-600">
            Selected:{" "}
            {selectedFile.name} ·{" "}
            {formatSize(
              selectedFile.size,
            )}
          </p>
        ) : null}

        {uploadMutation.isError ? (
          <p className="mt-3 text-sm text-red-700">
            Upload failed. Check the file type and size and try again.
          </p>
        ) : null}

        {uploadMutation.isSuccess ? (
          <p className="mt-3 text-sm text-green-700">
            File uploaded successfully.
          </p>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {(
          [
            [
              "all",
              "All",
            ],
            [
              "profile",
              "Profile",
            ],
            [
              "articles",
              "Articles",
            ],
            [
              "other",
              "Other",
            ],
          ] as const
        ).map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setFilter(value)
              }
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                filter === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {isLoading ||
      isError ? (
        <DataState
          isLoading={isLoading}
          isError={isError}
          empty={false}
        />
      ) : !filtered.length ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold text-slate-900">
            No media here yet
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload a file above when you need a profile or article asset.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(
            (item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <div className="flex h-48 items-center justify-center bg-slate-100">
                  {isImage(
                    item,
                  ) ? (
                    <AssetImage
                      asset={item}
                      alt={
                        item.original_filename
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="px-6 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        {item.content_type ??
                          "File"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="break-words font-semibold text-slate-900">
                      {
                        item.original_filename
                      }
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {purposeLabel(
                        item.purpose,
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">
                        Access
                      </p>
                      <p className="font-medium text-slate-800">
                        {visibilityLabel(
                          item.visibility,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Size
                      </p>
                      <p className="font-medium text-slate-800">
                        {formatSize(
                          item.size_bytes,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Used by
                      </p>
                      <p className="font-medium text-slate-800">
                        {
                          item.usage_count
                        }{" "}
                        {item.usage_count ===
                        1
                          ? "place"
                          : "places"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">
                        Uploaded
                      </p>
                      <p className="font-medium text-slate-800">
                        {formatDate(
                          item.created_at,
                        )}
                      </p>
                    </div>
                  </div>

                  {item.usage_count >
                  0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      This asset is currently in use. Remove or replace its references before deleting it.
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="danger"
                    disabled={
                      item.usage_count >
                        0 ||
                      deleteMutation.isPending
                    }
                    onClick={() =>
                      deleteMutation.mutate(
                        item.id,
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
