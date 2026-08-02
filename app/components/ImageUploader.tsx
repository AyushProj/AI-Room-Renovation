"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import CornerFrame from "./CornerFrame";

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
      return "That file type isn't supported. Use a JPG, PNG, or WEBP image.";
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `That image is too large. Keep it under ${MAX_FILE_SIZE_MB}MB.`;
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
          .createSignedUrl(path, 60 * 60);

      if (signedUrlError || !signedUrlData) {
        throw signedUrlError ?? new Error("Could not create signed URL");
      }

      setStatus("success");
      onUploadComplete?.(path, signedUrlData.signedUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(
        "The upload didn't go through. Check your connection and try again."
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
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors sm:py-20 ${
              isDragging
                ? "border-brass bg-brass/5"
                : "border-line hover:border-ink-muted"
            }`}
          >
            <p className="font-display text-sm font-medium text-ink">
              Drag a photo of your room here
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              or tap to browse — JPG, PNG, or WEBP, up to {MAX_FILE_SIZE_MB}MB
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
            className="space-y-3"
          >
            <CornerFrame className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Uploaded room preview"
                className="max-h-96 w-full object-cover"
              />
            </CornerFrame>
            <div className="flex items-center justify-between px-1">
              <StatusLabel status={status} />
              <button
                onClick={reset}
                className="text-sm font-medium text-ink-muted transition hover:text-ink"
              >
                Upload a different photo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-3 text-sm text-clay" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusLabel({ status }: { status: UploadStatus }) {
  if (status === "uploading") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />
        Uploading
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-sage-dark">
        <span className="h-1.5 w-1.5 rounded-full bg-sage" />
        Uploaded
      </span>
    );
  }
  if (status === "error") {
    return <span className="font-mono text-xs text-clay">Upload failed</span>;
  }
  return null;
}