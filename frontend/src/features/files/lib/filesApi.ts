import {
  apiClient,
  resolveApiAssetUrl,
} from "../../../lib/api-client";


export type FileVisibility =
  | "public"
  | "internal"
  | "private";


export type FilePurpose =
  | "general"
  | "therapist_profile_image"
  | "blog_cover_image"
  | "blog_inline_image"
  | "resource"
  | "service_image"
  | "product_image"
  | "landing_section_image"
  | "internal_document"
  | "private_document";


export type FileAsset = {
  id: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  storage_provider: string;
  visibility: FileVisibility;
  purpose: FilePurpose;
  public_url: string | null;
  content_url: string;
  usage_count: number;
  created_at: string;
};


export type FileAssetAdmin = FileAsset & {
  uploaded_by_user_id: string | null;
  owner_user_id: string | null;
};


export type FileAssetUsage = {
  id: string;
  file_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  created_at: string;
};


export function assetPublicUrl(
  asset: FileAsset,
) {
  if (!asset.public_url) {
    return null;
  }

  return resolveApiAssetUrl(
    asset.public_url,
  );
}


export async function fetchMyFiles() {
  const response =
    await apiClient.get<FileAsset[]>(
      "/files/mine",
    );

  return response.data;
}


export async function uploadMyFile(
  file: File,
  purpose: FilePurpose,
) {
  const formData = new FormData();

  formData.append(
    "upload",
    file,
  );

  formData.append(
    "purpose",
    purpose,
  );

  const response =
    await apiClient.post<FileAsset>(
      "/files/mine/upload",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      },
    );

  return response.data;
}


export async function deleteMyFile(
  fileId: string,
) {
  await apiClient.delete(
    `/files/mine/${fileId}`,
  );
}


export async function fetchMyFileUsage(
  fileId: string,
) {
  const response =
    await apiClient.get<FileAssetUsage[]>(
      `/files/mine/${fileId}/usage`,
    );

  return response.data;
}


export async function fetchAdminFiles() {
  const response =
    await apiClient.get<FileAssetAdmin[]>(
      "/files",
    );

  return response.data;
}


export async function deleteAdminFile(
  fileId: string,
) {
  await apiClient.delete(
    `/files/${fileId}`,
  );
}


export async function fetchAdminFileUsage(
  fileId: string,
) {
  const response =
    await apiClient.get<FileAssetUsage[]>(
      `/files/${fileId}/usage`,
    );

  return response.data;
}


export async function uploadAdminFile(
  file: File,
  purpose: FilePurpose,
  visibility: FileVisibility,
) {
  const formData = new FormData();

  formData.append(
    "upload",
    file,
  );

  formData.append(
    "purpose",
    purpose,
  );

  formData.append(
    "visibility",
    visibility,
  );

  const response =
    await apiClient.post<FileAssetAdmin>(
      "/files/upload",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      },
    );

  return response.data;
}
