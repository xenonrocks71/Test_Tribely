import api from "@/app/utils/api";

export interface PresignResponse {
  upload_url: string;
  public_url: string;
  object_key: string;
}

/**
 * Direct-to-Storage Presigned Media Upload Service.
 * Bypasses application server network interfaces by uploading direct to Cloud S3 / CDN.
 */
export class UploadService {
  /**
   * Request presigned upload URL from backend and upload file directly to cloud storage.
   */
  public async uploadMediaDirect(file: File): Promise<string> {
    // 1. Get presigned upload URL
    const presignRes = await api.post("/api/upload/presign", {
      filename: file.name,
      file_type: file.type || "image/jpeg",
    });

    const { upload_url, public_url } = presignRes.data;

    // 2. Perform direct binary upload to S3/CDN if upload_url is returned
    if (upload_url && upload_url.startsWith("http")) {
      await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/jpeg",
        },
        body: file,
      });
      return public_url;
    }

    return public_url;
  }
}

export const uploadService = new UploadService();
