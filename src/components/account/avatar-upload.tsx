"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { uploadAvatar, deleteAvatar } from "@/lib/actions/avatar";
import { Button } from "@/components/button";
import { Label } from "@/components/label";

type Props = {
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
};

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateClient(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Hanya file JPG, PNG, dan WebP yang diizinkan untuk avatar.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Ukuran file avatar tidak boleh melebihi 5 MB.";
  }
  return null;
}

export function AvatarUpload({ avatarUrl, onAvatarChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const displayUrl = preview ?? avatarUrl;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError("");
      setSuccess("");

      const validationError = validateClient(file);
      if (validationError) {
        setError(validationError);
        e.target.value = "";
        return;
      }

      // Clean up previous preview URL
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }

      const url = URL.createObjectURL(file);
      previewObjectUrlRef.current = url;
      setPreview(url);
      setSelectedFile(file);
    },
    [],
  );

  const handleClearPreview = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreview(null);
    setSelectedFile(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const result = await uploadAvatar(selectedFile);
      onAvatarChange(result.avatar_url);
      setSuccess("Avatar berhasil diperbarui.");
      handleClearPreview();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengunggah avatar.",
      );
    } finally {
      setUploading(false);
    }
  }, [selectedFile, onAvatarChange, handleClearPreview]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await deleteAvatar();
      onAvatarChange(null);
      setSuccess("Avatar berhasil dihapus.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus avatar.",
      );
    } finally {
      setDeleting(false);
    }
  }, [onAvatarChange]);

  return (
    <div className="rounded-2xl border bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">Foto Profil</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* Avatar display */}
        <div className="relative flex-shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Foto profil"
              className="h-24 w-24 rounded-full object-cover ring-2 ring-gray-200"
              onError={(e) => {
                // Handle broken image URL
                const img = e.target as HTMLImageElement;
                img.style.display = "none";
                const fallback = img.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-400 ring-2 ring-gray-200 ${
              displayUrl ? "hidden" : "flex"
            }`}
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="avatar-file-input">Ubah Foto Profil</Label>
          <p className="text-xs text-gray-500">
            Format: JPG, PNG, atau WebP. Maksimal 5 MB.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              id="avatar-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Pilih foto profil baru"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || deleting}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Pilih foto profil baru"
            >
              Pilih Foto
            </Button>

            {selectedFile && (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={uploading || deleting}
                  onClick={handleUpload}
                  aria-label="Unggah foto profil baru"
                >
                  {uploading ? "Mengunggah..." : "Unggah"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || deleting}
                  onClick={handleClearPreview}
                  aria-label="Batalkan pilihan foto"
                >
                  Batal
                </Button>
              </>
            )}

            {avatarUrl && !selectedFile && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={uploading || deleting}
                onClick={handleDelete}
                aria-label="Hapus foto profil"
              >
                {deleting ? "Menghapus..." : "Hapus Foto"}
              </Button>
            )}
          </div>

          {selectedFile && (
            <p className="text-xs text-gray-500">
              File dipilih: {selectedFile.name} (
              {(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
