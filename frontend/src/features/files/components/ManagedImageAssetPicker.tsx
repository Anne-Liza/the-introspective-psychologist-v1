import {
  useId,
  type ChangeEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ImagePlus,
  Trash2,
} from "lucide-react";

import { AssetImage } from "./AssetImage";
import {
  fetchAdminFiles,
  fetchMyFiles,
  uploadAdminFile,
  uploadMyFile,
  type FilePurpose,
} from "../lib/filesApi";


type ManagedImageScope =
  | "mine"
  | "admin";


type ManagedImageAssetPickerProps = {
  label?: string;
  purpose: FilePurpose;
  selectedAssetId: string | null;
  legacyUrl?: string | null;
  scope: ManagedImageScope;
  disabled?: boolean;
  onChange: (
    assetId: string | null,
  ) => void;
};


export function ManagedImageAssetPicker({
  label = "Image",
  purpose,
  selectedAssetId,
  legacyUrl,
  scope,
  disabled = false,
  onChange,
}: ManagedImageAssetPickerProps) {
  const inputId = useId();
  const queryClient = useQueryClient();

  const queryKey =
    scope === "admin"
      ? ["admin-media"]
      : ["my-media"];

  const mediaQuery = useQuery({
    queryKey,
    queryFn: () =>
      scope === "admin"
        ? fetchAdminFiles()
        : fetchMyFiles(),
  });

  const matchingAssets = (
    mediaQuery.data ?? []
  ).filter(
    (asset) =>
      asset.purpose === purpose &&
      Boolean(
        asset.content_type?.startsWith(
          "image/",
        ),
      ),
  );

  const selectedAsset =
    matchingAssets.find(
      (asset) =>
        asset.id === selectedAssetId,
    ) ?? null;

  const uploadMutation =
    useMutation({
      mutationFn: (
        file: File,
      ) =>
        scope === "admin"
          ? uploadAdminFile(
              file,
              purpose,
              "internal",
            )
          : uploadMyFile(
              file,
              purpose,
            ),

      onSuccess: async (
        asset,
      ) => {
        await queryClient.invalidateQueries({
          queryKey,
        });

        onChange(asset.id);
      },
    });

  function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (file) {
      uploadMutation.mutate(file);
    }

    event.target.value = "";
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <p className="text-sm font-semibold text-app-ink">
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-app-muted">
          Upload a new image or choose one
          already saved in media.
        </p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-app-border bg-app-tint p-4 md:grid-cols-[12rem_1fr]">
        <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-app-border bg-white">
          {selectedAsset ? (
            <AssetImage
              asset={selectedAsset}
              alt={`${label} preview`}
              className="h-full w-full object-cover"
            />
          ) : legacyUrl ? (
            <img
              src={legacyUrl}
              alt={`${label} preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs leading-5 text-app-muted">
              No image selected
            </div>
          )}
        </div>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">
              Choose saved image
            </span>

            <select
              value={selectedAssetId ?? ""}
              disabled={
                disabled ||
                mediaQuery.isLoading
              }
              onChange={(event) =>
                onChange(
                  event.target.value ||
                    null,
                )
              }
              className="w-full rounded-2xl border border-app-border bg-white px-4 py-3 text-sm text-app-ink outline-none transition focus:border-app-accent focus:ring-2 focus:ring-[#edf2e7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {matchingAssets.length
                  ? "Choose an image"
                  : "No saved images"}
              </option>

              {selectedAssetId &&
              !selectedAsset ? (
                <option
                  value={selectedAssetId}
                >
                  Current managed image
                </option>
              ) : null}

              {matchingAssets.map(
                (asset) => (
                  <option
                    key={asset.id}
                    value={asset.id}
                  >
                    {
                      asset.original_filename
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className={[
                "inline-flex items-center gap-2 rounded-full border border-app-border bg-white px-4 py-2.5 text-sm font-semibold text-app-ink transition",
                disabled ||
                uploadMutation.isPending
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-app-soft",
              ].join(" ")}
            >
              <ImagePlus className="h-4 w-4" />

              {uploadMutation.isPending
                ? "Uploading..."
                : "Upload new image"}
            </label>

            <input
              id={inputId}
              type="file"
              accept="image/*"
              disabled={
                disabled ||
                uploadMutation.isPending
              }
              onChange={handleUpload}
              className="sr-only"
            />

            {selectedAssetId ||
            legacyUrl ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(null)
                }
                className="inline-flex items-center gap-2 rounded-full border border-app-border bg-white px-4 py-2.5 text-sm font-semibold text-app-muted transition hover:bg-app-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove image
              </button>
            ) : null}
          </div>

          {selectedAsset ? (
            <p className="text-xs leading-5 text-app-muted">
              Selected:{" "}
              <span className="font-semibold text-app-ink">
                {
                  selectedAsset.original_filename
                }
              </span>
              {" · "}
              {selectedAsset.visibility ===
              "public"
                ? "Public"
                : "Internal working media"}
            </p>
          ) : legacyUrl ? (
            <p className="text-xs leading-5 text-app-muted">
              This content is using an
              existing legacy image. Choose
              or upload a managed image to
              replace it.
            </p>
          ) : null}

          {uploadMutation.isError ? (
            <p className="text-xs font-medium text-red-700">
              The image could not be
              uploaded. Please try again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
