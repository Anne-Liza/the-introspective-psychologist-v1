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

import {
  Button,
} from "../../../components/ui/Button";

import {
  DataState,
} from "../../../components/data/DataState";

import {
  PageHeader,
} from "../../../components/data/PageHeader";

import {
  AssetImage,
} from "../components/AssetImage";

import {
  assetPublicUrl,
  deleteAdminFile,
  fetchAdminFiles,
  type FileAssetAdmin,
  type FilePurpose,
  type FileVisibility,
  uploadAdminFile,
} from "../lib/filesApi";


type UsageFilter =
  | "all"
  | "used"
  | "unused";


const PURPOSE_OPTIONS: Array<{
  value: FilePurpose;
  label: string;
}> = [
  {
    value: "general",
    label: "General",
  },
  {
    value:
      "therapist_profile_image",
    label: "Therapist profile image",
  },
  {
    value: "blog_cover_image",
    label: "Article cover image",
  },
  {
    value: "blog_inline_image",
    label: "Article inline image",
  },
  {
    value: "resource",
    label: "Resource",
  },
  {
    value: "service_image",
    label: "Service image",
  },
  {
    value: "product_image",
    label: "Product image",
  },
  {
    value: "internal_document",
    label: "Internal document",
  },
  {
    value: "private_document",
    label: "Private document",
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
  asset: FileAssetAdmin,
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
  return (
    PURPOSE_OPTIONS.find(
      (item) =>
        item.value === purpose,
    )?.label ??
    purpose.replace(
      /_/g,
      " ",
    )
  );
}


function visibilityLabel(
  visibility: FileVisibility,
) {
  if (
    visibility === "public"
  ) {
    return "Public";
  }

  if (
    visibility === "private"
  ) {
    return "Private";
  }

  return "Internal";
}


export function FilesPage() {
  const queryClient =
    useQueryClient();

  const [file, setFile] =
    useState<File | null>(null);

  const [
    visibility,
    setVisibility,
  ] = useState<FileVisibility>(
    "internal",
  );

  const [
    purpose,
    setPurpose,
  ] = useState<FilePurpose>(
    "general",
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    visibilityFilter,
    setVisibilityFilter,
  ] = useState<
    FileVisibility | "all"
  >("all");

  const [
    usageFilter,
    setUsageFilter,
  ] = useState<UsageFilter>(
    "all",
  );

  const [
    copiedId,
    setCopiedId,
  ] = useState<string | null>(
    null,
  );

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "admin-media",
    ],
    queryFn: fetchAdminFiles,
  });

  const uploadMutation =
    useMutation({
      mutationFn: () => {
        if (!file) {
          throw new Error(
            "Choose a file first.",
          );
        }

        return uploadAdminFile(
          file,
          purpose,
          visibility,
        );
      },
      onSuccess: () => {
        setFile(null);

        queryClient.invalidateQueries({
          queryKey: [
            "admin-media",
          ],
        });
      },
    });

  const deleteMutation =
    useMutation({
      mutationFn: deleteAdminFile,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "admin-media",
          ],
        });
      },
    });

  const files =
    useMemo(
      () => data ?? [],
      [data],
    );

  const filteredFiles =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      return files.filter(
        (item) => {
          if (
            needle &&
            ![
              item.original_filename,
              item.purpose,
              item.content_type ?? "",
            ].some((value) =>
              value
                .toLowerCase()
                .includes(
                  needle,
                ),
            )
          ) {
            return false;
          }

          if (
            visibilityFilter !==
              "all" &&
            item.visibility !==
              visibilityFilter
          ) {
            return false;
          }

          if (
            usageFilter === "used" &&
            item.usage_count === 0
          ) {
            return false;
          }

          if (
            usageFilter ===
              "unused" &&
            item.usage_count > 0
          ) {
            return false;
          }

          return true;
        },
      );
    }, [
      files,
      search,
      usageFilter,
      visibilityFilter,
    ]);

  const imageCount =
    files.filter(
      isImage,
    ).length;

  const publicCount =
    files.filter(
      (item) =>
        item.visibility ===
        "public",
    ).length;

  function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!file) {
      return;
    }

    uploadMutation.mutate();
  }

  async function handleCopy(
    asset: FileAssetAdmin,
  ) {
    const url =
      assetPublicUrl(
        asset,
      );

    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(
      url,
    );

    setCopiedId(
      asset.id,
    );

    window.setTimeout(
      () =>
        setCopiedId(null),
      1500,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Media Library"
        description="Manage reusable public, internal, and private assets used across the practice."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total assets
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {files.length}
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
            Public assets
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {publicCount}
          </p>
        </div>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Upload asset
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Internal is the safest default. Mark an asset public only when it is intended for the public website.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_auto] xl:items-end">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              File
            </span>

            <input
              type="file"
              onChange={(
                event,
              ) =>
                setFile(
                  event.target
                    .files?.[0] ??
                    null,
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Purpose
            </span>

            <select
              value={purpose}
              onChange={(
                event,
              ) =>
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

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">
              Access
            </span>

            <select
              value={
                visibility
              }
              onChange={(
                event,
              ) =>
                setVisibility(
                  event.target
                    .value as FileVisibility,
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="internal">
                Internal
              </option>
              <option value="private">
                Private
              </option>
              <option value="public">
                Public
              </option>
            </select>
          </label>

          <Button
            type="submit"
            disabled={
              !file ||
              uploadMutation.isPending
            }
          >
            {uploadMutation.isPending
              ? "Uploading..."
              : "Upload"}
          </Button>
        </div>

        {file ? (
          <p className="mt-3 text-sm text-slate-600">
            Selected:{" "}
            {file.name} ·{" "}
            {formatSize(
              file.size,
            )}
          </p>
        ) : null}

        {uploadMutation.isError ? (
          <p className="mt-3 text-sm text-red-700">
            Upload failed. Check the file type, size, purpose, and access settings.
          </p>
        ) : null}
      </form>

      <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={(
            event,
          ) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search filename or purpose..."
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />

        <select
          value={
            visibilityFilter
          }
          onChange={(
            event,
          ) =>
            setVisibilityFilter(
              event.target
                .value as
                | FileVisibility
                | "all",
            )
          }
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">
            All access levels
          </option>
          <option value="public">
            Public
          </option>
          <option value="internal">
            Internal
          </option>
          <option value="private">
            Private
          </option>
        </select>

        <select
          value={
            usageFilter
          }
          onChange={(
            event,
          ) =>
            setUsageFilter(
              event.target
                .value as UsageFilter,
            )
          }
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">
            All usage
          </option>
          <option value="used">
            In use
          </option>
          <option value="unused">
            Unused
          </option>
        </select>
      </div>

      {isLoading ||
      isError ? (
        <DataState
          isLoading={
            isLoading
          }
          isError={
            isError
          }
          empty={false}
        />
      ) : !filteredFiles.length ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="font-semibold text-slate-900">
            No matching assets
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Adjust the filters or upload a new asset.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFiles.map(
            (item) => {
              const deletionBlocked =
                item.visibility ===
                  "public" ||
                item.usage_count >
                  0;

              return (
                <article
                  key={
                    item.id
                  }
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <div className="flex h-48 items-center justify-center bg-slate-100">
                    {isImage(
                      item,
                    ) ? (
                      <AssetImage
                        asset={
                          item
                        }
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
                          Usage
                        </p>
                        <p className="font-medium text-slate-800">
                          {
                            item.usage_count
                          }{" "}
                          {item.usage_count ===
                          1
                            ? "reference"
                            : "references"}
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

                    {item.visibility ===
                    "public" ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Public assets are protected from direct deletion. Replace or unpublish the content using this asset first.
                      </p>
                    ) : item.usage_count >
                      0 ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        This asset is in use and cannot be deleted until its references are removed.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {item.public_url ? (
                        <Button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              item,
                            )
                          }
                        >
                          {copiedId ===
                          item.id
                            ? "Copied"
                            : "Copy public URL"}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="danger"
                        disabled={
                          deletionBlocked ||
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
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
