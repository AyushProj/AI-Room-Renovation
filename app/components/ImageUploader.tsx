"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface ImageUploaderProps {
  userId: string;
  onUploadComplete?: (path: string, signedUrl: string) => void;
}

export default function ImageUploader({
  userId,
  onUploadComplete,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a JPG, PNG, or WEBP image.";
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `Image must be under ${MAX_FILE_SIZE_MB}MB.`;
    }
    return null;
  }

  async function handleFile(file: File) {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setStatus("uploading");

    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("room-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from("room-images")
          .createSignedUrl(path, 60 * 60); // valid 1 hour, enough for this session

      if (signedUrlError || !signedUrlData) {
        throw signedUrlError ?? new Error("Could not create signed URL");
      }

      setStatus("success");
      onUploadComplete?.(path, signedUrlData.signedUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setStatus("error");
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setPreview(null);
    setStatus("idle");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="w-full max-w-lg">
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
              isDragging
                ? "border-gray-900 bg-gray-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <p className="text-sm font-medium text-gray-700">
              Drag and drop a photo of your room here
            </p>
            <p className="mt-1 text-sm text-gray-400">
              or click to browse — JPG, PNG, or WEBP, up to {MAX_FILE_SIZE_MB}MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="overflow-hidden rounded-xl border border-gray-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Uploaded room preview"
              className="max-h-96 w-full object-cover"
            />
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
              <StatusLabel status={status} />
              <button
                onClick={reset}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Upload a different photo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusLabel({ status }: { status: UploadStatus }) {
  if (status === "uploading") {
    return <span className="text-sm text-gray-500">Uploading...</span>;
  }
  if (status === "success") {
    return <span className="text-sm text-green-600">Uploaded ✓</span>;
  }
  if (status === "error") {
    return <span className="text-sm text-red-600">Upload failed</span>;
  }
  return null;
}
