import {
  useEffect,
  useState,
} from "react";

import {
  apiClient,
  resolveApiAssetUrl,
} from "../../../lib/api-client";

import type {
  FileAsset,
} from "../lib/filesApi";


type AssetImageProps = {
  asset: FileAsset;
  alt: string;
  className?: string;
};


type PrivatePreviewState = {
  assetId: string;
  src: string | null;
  failed: boolean;
};


export function AssetImage({
  asset,
  alt,
  className,
}: AssetImageProps) {
  const [
    privatePreview,
    setPrivatePreview,
  ] = useState<PrivatePreviewState>({
    assetId: "",
    src: null,
    failed: false,
  });

  useEffect(() => {
    if (asset.public_url) {
      return;
    }

    let objectUrl: string | null =
      null;

    let cancelled = false;

    apiClient
      .get(
        asset.content_url,
        {
          responseType: "blob",
        },
      )
      .then((response) => {
        if (cancelled) {
          return;
        }

        objectUrl =
          URL.createObjectURL(
            response.data,
          );

        setPrivatePreview({
          assetId: asset.id,
          src: objectUrl,
          failed: false,
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setPrivatePreview({
          assetId: asset.id,
          src: null,
          failed: true,
        });
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, [
    asset.content_url,
    asset.id,
    asset.public_url,
  ]);

  const publicSrc =
    asset.public_url
      ? resolveApiAssetUrl(
          asset.public_url,
        )
      : null;

  const privateSrc =
    privatePreview.assetId ===
    asset.id
      ? privatePreview.src
      : null;

  const failed =
    !asset.public_url &&
    privatePreview.assetId ===
      asset.id &&
    privatePreview.failed;

  const src =
    publicSrc ??
    privateSrc;

  if (failed) {
    return (
      <div
        className={
          className ??
          "flex h-full w-full items-center justify-center"
        }
      >
        <span className="text-sm text-slate-500">
          Preview unavailable
        </span>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={
          className ??
          "flex h-full w-full items-center justify-center"
        }
      >
        <span className="text-sm text-slate-500">
          Loading preview...
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
    />
  );
}
