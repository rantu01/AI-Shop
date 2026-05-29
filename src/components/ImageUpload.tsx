import React, { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  label?: string;
  currentImageUrl?: string;
}

export default function ImageUpload({
  onUploadComplete,
  label = "Upload Image via Cloudinary",
  currentImageUrl,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setUploading(true);
    setError(null);

    // Read file as base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: base64data }),
        });

        if (!response.ok) {
          let errMsg = "Upload failed";
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              const errData = await response.json();
              errMsg = errData.error || errMsg;
            } catch (e) {
              // ignore json parse error on invalid json
            }
          } else {
            try {
              const text = await response.text();
              if (text && text.length < 150) {
                errMsg = text;
              }
            } catch (e) {
              // ignore
            }
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (data.url) {
          setPreview(data.url);
          onUploadComplete(data.url);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err: any) {
        console.error("Cloudinary upload hook error:", err);
        setError(err.message || "Failed to upload image. Please check credentials.");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read local file.");
      setUploading(false);
    };
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const triggerSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-2" id="cloudinary-image-uploader-wrapper">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50"
            : "border-slate-200 bg-slate-50 hover:bg-slate-100/55 hover:border-slate-300"
        }`}
        id="drag-drop-zone"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          id="hidden-file-input"
        />

        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold text-slate-700">Uploading to Cloudinary...</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative group/thumb">
              <img
                src={preview}
                alt="Uploaded Preview"
                className="h-14 w-14 rounded-lg object-cover border border-slate-200 shadow-sm"
              />
              <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 max-w-[200px] truncate">
              {preview}
            </p>
            <span className="text-[10px] text-indigo-600 font-bold">
              Click or drag to change image
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
            <div className="text-xs">
              <span className="font-bold text-indigo-600">Click to upload</span> or drag and drop
            </div>
            <p className="text-[10px] text-slate-400">PNG, JPG, GIF up to 5MB</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-0 bottom-1 px-4 text-[10px] font-bold text-red-600 truncate">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
