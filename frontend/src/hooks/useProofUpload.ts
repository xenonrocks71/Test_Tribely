"use client";

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { PresignedUploadResponse } from "@/types/tribely";

export interface ProofUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedUrl: string | null;
}

export function useProofUpload() {
  const [state, setState] = useState<ProofUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadedUrl: null,
  });

  /**
   * Directly uploads binary media to cloud storage via presigned URL,
   * then records atomic proof submission in Tribely backend.
   */
  const uploadAndSubmit = useCallback(
    async (
      arenaId: number,
      file: File,
      options: {
        caption?: string;
        telemetryData?: Record<string, any>;
        selfieBlob?: Blob | null;
      } = {}
    ) => {
      setState({ isUploading: true, progress: 5, error: null, uploadedUrl: null });

      try {
        // Step 1: Request presigned upload URL from Tribely backend
        const presignedRes = await apiClient.post<any>("/api/activity/upload-url", {
          filename: file.name,
          content_type: file.type || "image/jpeg",
        });

        const uploadData = presignedRes?.data || presignedRes;
        const uploadUrl: string = uploadData?.upload_url || uploadData?.uploadUrl;
        const publicFileUrl: string = uploadData?.file_url || uploadData?.fileUrl || (uploadUrl ? uploadUrl.split("?")[0] : "");

        if (!uploadUrl) {
          throw new Error("Failed to obtain secure cloud storage presigned upload URL.");
        }

        setState((prev) => ({ ...prev, progress: 30 }));

        // Step 2: Direct-to-Cloud binary stream upload (S3 / Cloudflare R2 / Storage API)
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "image/jpeg",
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Direct cloud upload failed with status ${uploadResponse.status}.`);
        }

        setState((prev) => ({ ...prev, progress: 75, uploadedUrl: publicFileUrl }));

        // Step 3: Atomic database proof registration with composite constraint check
        const submitRes = await apiClient.post<any>("/api/activity/submit", {
          arena_id: arenaId,
          proof_url: publicFileUrl,
          client_submitted_at: new Date().toISOString(),
          caption: options.caption || "",
          telemetry_data: options.telemetryData || {},
        });

        setState((prev) => ({ ...prev, isUploading: false, progress: 100 }));

        return {
          success: true,
          proofUrl: publicFileUrl,
          data: submitRes.data,
        };
      } catch (err: any) {
        const errorMsg = err?.response?.data?.detail || err?.message || "Proof upload and submission failed.";
        setState({
          isUploading: false,
          progress: 0,
          error: errorMsg,
          uploadedUrl: null,
        });
        throw new Error(errorMsg);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: 0, error: null, uploadedUrl: null });
  }, []);

  return {
    ...state,
    uploadAndSubmit,
    reset,
  };
}
