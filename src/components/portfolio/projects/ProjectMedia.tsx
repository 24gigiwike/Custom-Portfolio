import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from "react";
import {
  Image as ImageIcon,
  UploadCloud,
  Link as LinkIcon,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Check,
} from "lucide-react";
import { deleteStoredImage, uploadProjectImage, validateImageFile } from "../../../lib/storage";

interface ProjectMediaProps {
  portfolioId: string;
  projectId: string;
  coverImage: string | null;
  coverImagePath?: string | null;
  images: string[];
  imagePaths?: string[];
  onCoverImageChange: (url: string | null, storagePath?: string | null) => void;
  onImagesChange: (urls: string[], storagePaths: string[]) => void;
}

export interface ProjectMediaHandle {
  cancelPendingUploads: () => void;
}

interface GalleryItem {
  id: string;
  url: string;
  storagePath?: string;
  isLocal: boolean;
  file?: File;
  status: "optimizing" | "uploading" | "complete" | "error";
  progress: number;
  error?: string;
}

function completedGallery(items: GalleryItem[]): { urls: string[]; paths: string[] } {
  const completed = items.filter((item) => item.status === "complete" && !item.isLocal);
  return {
    urls: completed.map((item) => item.url),
    paths: completed.map((item) => item.storagePath || ""),
  };
}

export const ProjectMedia = React.forwardRef<ProjectMediaHandle, ProjectMediaProps>(function ProjectMedia({
  portfolioId,
  projectId,
  coverImage,
  coverImagePath,
  images,
  imagePaths,
  onCoverImageChange,
  onImagesChange,
}, ref) {
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const [showGalleryUrlInput, setShowGalleryUrlInput] = useState(false);
  const [galleryUrlValue, setGalleryUrlValue] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Cover image local state
  const [coverLocalFile, setCoverLocalFile] = useState<File | null>(null);
  const [coverLocalPreview, setCoverLocalPreview] = useState<string | null>(null);
  const [coverUploadState, setCoverUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    statusText: string;
    error?: string;
  }>({
    isUploading: false,
    progress: 0,
    statusText: "",
  });

  // Gallery items state
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => {
    return images.map((url, idx) => ({
      id: `remote_${idx}_${url}`,
      url,
      storagePath: imagePaths?.[idx] || "",
      isLocal: false,
      status: "complete",
      progress: 100,
    }));
  });

  const cancelledRef = useRef(false);
  const knownCoverRef = useRef<{ url: string; storagePath: string } | null>(
    coverImage && coverImagePath ? { url: coverImage, storagePath: coverImagePath } : null
  );

  useImperativeHandle(ref, () => ({
    cancelPendingUploads() {
      cancelledRef.current = true;
    },
  }), []);

  // Keep track of active object URLs for cleanup
  const activeObjectUrls = useRef<Set<string>>(new Set());

  const registerObjectUrl = (url: string) => {
    activeObjectUrls.current.add(url);
    return url;
  };

  const revokeObjectUrl = (url: string) => {
    if (activeObjectUrls.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      activeObjectUrls.current.delete(url);
    }
  };

  // Clean up all object URLs on unmount
  useEffect(() => {
    const urls = activeObjectUrls.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      urls.clear();
    };
  }, []);

  // Sync external remote images prop into galleryItems if external prop changed
  useEffect(() => {
    setGalleryItems((prev) => {
      // Keep any local/in-progress items, update remote completed ones
      const localOrUploading = prev.filter((item) => item.isLocal && item.status !== "complete");
      const currentCompleted = prev.filter((item) => !item.isLocal && item.status === "complete");
      const currentCompletedUrls = currentCompleted.map((item) => item.url);
      const currentCompletedPaths = currentCompleted.map((item) => item.storagePath || "");
      const nextPaths = images.map((_, idx) => imagePaths?.[idx] || "");

      const arraysEqual =
        currentCompletedUrls.length === images.length &&
        currentCompletedUrls.every((val, idx) => val === images[idx]) &&
        currentCompletedPaths.length === nextPaths.length &&
        currentCompletedPaths.every((val, idx) => val === nextPaths[idx]);

      if (arraysEqual) {
        return prev;
      }

      const newRemoteItems: GalleryItem[] = images.map((url, idx) => ({
        id: `remote_${idx}_${url}`,
        url,
        storagePath: imagePaths?.[idx] || "",
        isLocal: false,
        status: "complete",
        progress: 100,
      }));

      return [...newRemoteItems, ...localOrUploading];
    });
  }, [images, imagePaths]);

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------------
   * COVER IMAGE UPLOAD PIPELINE
   * ------------------------------------------------------------------ */

  const startCoverUpload = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setMediaError(validation.error || "Please select a valid image file.");
      return;
    }

    setMediaError(null);
    setCoverLocalFile(file);

    // Immediate Local Preview
    const localUrl = registerObjectUrl(URL.createObjectURL(file));
    setCoverLocalPreview(localUrl);
    setCoverUploadState({
      isUploading: true,
      progress: 0,
      statusText: "Preparing...",
    });

    try {
      const uploaded = await uploadProjectImage(portfolioId, projectId, file, {
        folder: "cover",
        onProgress: (percent) => {
          setCoverUploadState((prev) => ({
            ...prev,
            progress: percent,
            statusText: percent < 100 ? `Uploading ${percent}%` : "Finalizing...",
          }));
        },
      });

      if (cancelledRef.current) {
        try {
          await deleteStoredImage(uploaded.storagePath);
        } catch (deleteError) {
          console.error("Cancelled cover upload cleanup failed:", deleteError);
        }
        return;
      }

      knownCoverRef.current = { url: uploaded.downloadUrl, storagePath: uploaded.storagePath };
      onCoverImageChange(uploaded.downloadUrl, uploaded.storagePath);
      setCoverUploadState({
        isUploading: false,
        progress: 100,
        statusText: "",
      });
      revokeObjectUrl(localUrl);
      setCoverLocalPreview(null);
      setCoverLocalFile(null);
    } catch (err) {
      console.error("Cover upload error:", err);
      const msg = err instanceof Error ? err.message : "Cover image upload failed.";
      setCoverUploadState({
        isUploading: false,
        progress: 0,
        statusText: "",
        error: msg,
      });
    }
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startCoverUpload(file);
    if (coverFileInputRef.current) coverFileInputRef.current.value = "";
  };

  const handleRetryCoverUpload = () => {
    if (coverLocalFile) {
      startCoverUpload(coverLocalFile);
    }
  };

  const handleRemoveCover = () => {
    if (coverLocalPreview) {
      revokeObjectUrl(coverLocalPreview);
    }
    setCoverLocalPreview(null);
    setCoverLocalFile(null);
    setCoverUploadState({
      isUploading: false,
      progress: 0,
      statusText: "",
    });
    onCoverImageChange(null, null);
  };

  /* ------------------------------------------------------------------
   * GALLERY UPLOAD PIPELINE (Controlled Concurrency: 2 simultaneous)
   * ------------------------------------------------------------------ */

  const uploadQueueActive = useRef(false);

  const processGalleryQueue = useCallback(
    async (itemsToProcess: GalleryItem[]) => {
      if (uploadQueueActive.current) return;
      uploadQueueActive.current = true;

      const CONCURRENCY_LIMIT = 2;
      const pendingItems = itemsToProcess.filter(
        (item) => item.status === "optimizing" && item.file
      );

      if (pendingItems.length === 0) {
        uploadQueueActive.current = false;
        return;
      }

      // Worker pool
      let index = 0;

      const worker = async () => {
        while (index < pendingItems.length) {
          if (cancelledRef.current) return;
          const currentItem = pendingItems[index++];
          if (!currentItem || !currentItem.file) continue;

          // Update status to uploading
          setGalleryItems((prev) =>
            prev.map((it) =>
              it.id === currentItem.id
                ? { ...it, status: "uploading", progress: 5 }
                : it
            )
          );

          try {
            const uploaded = await uploadProjectImage(
              portfolioId,
              projectId,
              currentItem.file,
              {
                folder: "gallery",
                onProgress: (percent) => {
                  setGalleryItems((prev) =>
                    prev.map((it) =>
                      it.id === currentItem.id
                        ? { ...it, progress: percent }
                        : it
                    )
                  );
                },
              }
            );

            if (cancelledRef.current) {
              try {
                await deleteStoredImage(uploaded.storagePath);
              } catch (deleteError) {
                console.error("Cancelled gallery upload cleanup failed:", deleteError);
              }
              return;
            }

            // Item succeeded
            revokeObjectUrl(currentItem.url);

            setGalleryItems((prev) => {
              const updated = prev.map((it) =>
                it.id === currentItem.id
                  ? {
                      ...it,
                      url: uploaded.downloadUrl,
                      storagePath: uploaded.storagePath,
                      isLocal: false,
                      status: "complete" as const,
                      progress: 100,
                    }
                  : it
              );

              const completed = completedGallery(updated);
              onImagesChange(completed.urls, completed.paths);

              return updated;
            });
          } catch (err) {
            console.error("Gallery item upload failed:", err);
            const msg = err instanceof Error ? err.message : "Upload failed.";
            setGalleryItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id
                  ? { ...it, status: "error", error: msg }
                  : it
              )
            );
          }
        }
      };

      // Run up to CONCURRENCY_LIMIT workers in parallel
      const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, pendingItems.length) },
        () => worker()
      );
      await Promise.all(workers);

      uploadQueueActive.current = false;
    },
    [portfolioId, projectId, onImagesChange]
  );

  const handleGalleryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setMediaError(null);

    const newItems: GalleryItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setMediaError(validation.error || `File ${file.name} is unsupported.`);
        continue;
      }

      const localUrl = registerObjectUrl(URL.createObjectURL(file));
      const newItem: GalleryItem = {
        id: `local_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        url: localUrl,
        isLocal: true,
        file,
        status: "optimizing",
        progress: 0,
      };
      newItems.push(newItem);
    }

    if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    if (newItems.length === 0) return;

    setGalleryItems((prev) => {
      const combined = [...prev, ...newItems];
      // Trigger queue processing
      setTimeout(() => processGalleryQueue(combined), 10);
      return combined;
    });
  };

  const handleRetryGalleryItem = (itemToRetry: GalleryItem) => {
    if (!itemToRetry.file) return;
    setGalleryItems((prev) => {
      const updated = prev.map((it) =>
        it.id === itemToRetry.id
          ? { ...it, status: "optimizing" as const, progress: 0, error: undefined }
          : it
      );
      setTimeout(() => processGalleryQueue(updated), 10);
      return updated;
    });
  };

  const handleRemoveGalleryItem = (itemToRemove: GalleryItem) => {
    if (itemToRemove.isLocal) {
      revokeObjectUrl(itemToRemove.url);
    }
    setGalleryItems((prev) => {
      const updated = prev.filter((it) => it.id !== itemToRemove.id);
      const completed = completedGallery(updated);
      onImagesChange(completed.urls, completed.paths);
      return updated;
    });
  };

  const handleMoveGalleryItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= galleryItems.length) return;
    const updated = [...galleryItems];
    const item = updated.splice(fromIdx, 1)[0];
    updated.splice(toIdx, 0, item);
    setGalleryItems(updated);

    const completed = completedGallery(updated);
    onImagesChange(completed.urls, completed.paths);
  };

  const handleAddGalleryUrl = () => {
    if (!galleryUrlValue.trim()) return;
    const newUrl = galleryUrlValue.trim();
    const newItem: GalleryItem = {
      id: `remote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: newUrl,
      isLocal: false,
      status: "complete",
      progress: 100,
    };
    setGalleryItems((prev) => {
      const updated = [...prev, newItem];
      const completed = completedGallery(updated);
      onImagesChange(completed.urls, completed.paths);
      return updated;
    });
    setGalleryUrlValue("");
    setShowGalleryUrlInput(false);
  };

  // Active cover preview to display (either in-flight local preview or saved remote cover)
  const displayCover = coverLocalPreview || coverImage;
  const isCoverActive = coverUploadState.isUploading;

  // Check how many gallery uploads are currently in progress
  const uploadingGalleryCount = galleryItems.filter(
    (item) => item.status === "uploading" || item.status === "optimizing"
  ).length;

  return (
    <section
      id="project-media-section"
      className="bg-white border border-[#D5E6E5] rounded-2xl p-6 sm:p-8 shadow-[0_12px_32px_rgba(109,174,173,0.08)]"
    >
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-[#D5E6E5]/70">
        <div>
          <span className="font-support text-[11px] uppercase tracking-[0.15em] text-[#5C7372] block mb-1">
            04 / Media
          </span>
          <h2 className="text-lg font-medium text-[#243838] tracking-[-0.02em]">
            Visual Imagery & Gallery
          </h2>
        </div>
        <span className="font-support text-[10px] uppercase tracking-[0.12em] text-[#6E8887]">
          Visual Assets
        </span>
      </div>

      {mediaError && (
        <div className="mb-6 p-3 bg-[#FFF6F6] border border-[#F3C7C7] rounded-2xl text-xs text-[#B93838] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mediaError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMediaError(null)}
            className="text-[#B93838] hover:opacity-80 p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------
       * COVER IMAGE SECTION
       * --------------------------------------------------------------- */}
      <div className="mb-8">
        <label className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block mb-2">
          Primary Cover Image
        </label>
        <p className="text-xs text-[#6E8887] font-light mb-4">
          The main image displayed on project cards and editorial hero layouts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
          {/* Cover Preview Card */}
          <div className="sm:col-span-1">
            {displayCover ? (
              <div className="relative group rounded-2xl border border-[#D5E6E5] overflow-hidden bg-[#F7FBFA] aspect-[4/3] flex items-center justify-center">
                <img
                  src={displayCover}
                  alt="Project cover preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-opacity duration-300"
                />

                {/* Uploading progress overlay */}
                {isCoverActive && (
                  <div className="absolute inset-0 bg-[#243838]/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin text-[#94CEBB] mb-2" />
                    <span className="font-mono text-xs font-medium text-white mb-1">
                      {coverUploadState.statusText || "Preparing..."}
                    </span>
                    {coverUploadState.progress > 0 && (
                      <div className="w-24 bg-white/20 h-1 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-[#94CEBB] h-full transition-all duration-200"
                          style={{ width: `${coverUploadState.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Error overlay */}
                {coverUploadState.error && !isCoverActive && (
                  <div className="absolute inset-0 bg-[#8C3030]/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center text-white">
                    <AlertCircle className="w-4 h-4 text-white mb-1" />
                    <span className="text-[11px] leading-tight mb-2">Upload failed</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRetryCoverUpload}
                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-white text-[#7F1D1D] px-2 py-1 rounded-2xl hover:bg-white/90"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="text-[10px] text-white/90 hover:text-white underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Remove button (when idle/complete) */}
                {!isCoverActive && !coverUploadState.error && (
                  <button
                    type="button"
                    aria-label="Remove cover image"
                    onClick={handleRemoveCover}
                    className="absolute top-2 right-2 p-1 bg-[#243838]/60 hover:bg-black text-white rounded-2xl opacity-90 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D5E6E5] bg-[#F7FBFA] aspect-[4/3] flex flex-col items-center justify-center p-4 text-center">
                <ImageIcon className="w-6 h-6 text-[#6E8887]/60 mb-2" />
                <span className="text-xs text-[#5C7372] font-medium">No cover image</span>
                <span className="text-[10px] text-[#6E8887] font-light mt-0.5">
                  Subtle neutral placeholder will be used
                </span>
              </div>
            )}
          </div>

          {/* Cover Actions */}
          <div className="sm:col-span-2 space-y-3">
            <input
              type="file"
              ref={coverFileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleCoverFileUpload}
              className="hidden"
              id="cover-file-input"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="upload-cover-button"
                disabled={isCoverActive}
                onClick={() => coverFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#243838] bg-white border border-[#D5E6E5] hover:border-[#6DAEAD] rounded-2xl transition-colors disabled:opacity-50"
              >
                {isCoverActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6DAEAD]" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5 text-[#5C7372]" />
                )}
                <span>{isCoverActive ? "Uploading..." : "Upload image file"}</span>
              </button>

              <button
                type="button"
                id="toggle-cover-url-button"
                onClick={() => setShowCoverUrlInput(!showCoverUrlInput)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[#5C7372] hover:text-[#243838] transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>{showCoverUrlInput ? "Hide image URL" : "Enter image URL"}</span>
              </button>
            </div>

            {showCoverUrlInput && (
              <div className="mt-2">
                <input
                  type="url"
                  id="cover-image-url-input"
                  value={coverImage || ""}
                  onChange={(e) => {
                    const next = e.target.value.trim() || null;
                    const known = knownCoverRef.current;
                    onCoverImageChange(
                      next,
                      known && next === known.url ? known.storagePath : null
                    );
                  }}
                  placeholder="https://..."
                  className="w-full text-xs font-mono px-3 py-2 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
                />
                <span className="font-support text-[10px] text-[#6E8887] mt-1 block">
                  Accepts direct links (JPG, PNG, WEBP)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------
       * GALLERY SECTION
       * --------------------------------------------------------------- */}
      <div className="pt-6 border-t border-[#D5E6E5]/70">
        <div className="flex items-baseline justify-between mb-2">
          <label className="font-support text-[11px] uppercase tracking-[0.14em] text-[#5C7372] block">
            Project Gallery
          </label>
          <div className="flex items-center gap-3">
            {uploadingGalleryCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6DAEAD] font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Uploading {uploadingGalleryCount} item{uploadingGalleryCount > 1 ? "s" : ""}</span>
              </span>
            )}
            <span className="text-[11px] font-mono text-[#6E8887]">
              {galleryItems.length} {galleryItems.length === 1 ? "image" : "images"}
            </span>
          </div>
        </div>
        <p className="text-xs text-[#6E8887] font-light mb-4">
          Supplementary visuals, interface screens, photography, or case study media.
        </p>

        {/* Gallery Thumbnails Grid with Immediate Previews & Progress */}
        {galleryItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {galleryItems.map((item, idx) => {
              const isUploading = item.status === "uploading" || item.status === "optimizing";
              const isError = item.status === "error";
              const isComplete = item.status === "complete";

              return (
                <div
                  key={item.id}
                  className="relative group rounded-2xl border border-[#D5E6E5] overflow-hidden bg-[#F7FBFA] aspect-[4/3] flex items-center justify-center"
                >
                  <img
                    src={item.url}
                    alt={`Gallery item ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />

                  {/* Uploading Progress Overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-[#243838]/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white">
                      <Loader2 className="w-4 h-4 animate-spin text-[#94CEBB] mb-1.5" />
                      <span className="font-mono text-[10px] text-white">
                        {item.status === "optimizing"
                          ? "Optimizing..."
                          : `${item.progress}%`}
                      </span>
                      {item.progress > 0 && (
                        <div className="w-16 bg-white/20 h-1 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-[#94CEBB] h-full transition-all duration-150"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Overlay */}
                  {isError && (
                    <div className="absolute inset-0 bg-[#8C3030]/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white">
                      <AlertCircle className="w-3.5 h-3.5 text-white mb-1" />
                      <span className="text-[10px] font-medium leading-tight mb-1.5">
                        Upload failed
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRetryGalleryItem(item)}
                          className="inline-flex items-center gap-1 text-[9px] font-medium bg-white text-[#7F1D1D] px-1.5 py-0.5 rounded-2xl hover:bg-white/90"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryItem(item)}
                          className="p-1 text-white/80 hover:text-white"
                          aria-label="Remove failed image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reorder and Delete Toolbar (Completed items) */}
                  {isComplete && (
                    <div className="absolute inset-0 bg-[#243838]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                      <button
                        type="button"
                        aria-label={`Move image ${idx + 1} left`}
                        disabled={idx === 0}
                        onClick={() => handleMoveGalleryItem(idx, idx - 1)}
                        className="p-1 bg-white/90 text-[#243838] rounded-2xl hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move image ${idx + 1} right`}
                        disabled={idx === galleryItems.length - 1}
                        onClick={() => handleMoveGalleryItem(idx, idx + 1)}
                        className="p-1 bg-white/90 text-[#243838] rounded-2xl hover:bg-white disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete image ${idx + 1}`}
                        onClick={() => handleRemoveGalleryItem(item)}
                        className="p-1 bg-[#B93838]/90 text-white rounded-2xl hover:bg-[#B93838]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="absolute bottom-1 left-1.5 font-mono text-[9px] text-white/90 drop-shadow-sm pointer-events-none">
                    0{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Gallery Upload Inputs */}
        <input
          type="file"
          ref={galleryFileInputRef}
          multiple
          accept="image/png, image/jpeg, image/webp"
          onChange={handleGalleryFileUpload}
          className="hidden"
          id="gallery-file-input"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="upload-gallery-button"
            disabled={uploadingGalleryCount > 0}
            onClick={() => galleryFileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#243838] bg-white border border-[#D5E6E5] hover:border-[#6DAEAD] rounded-2xl transition-colors disabled:opacity-60"
          >
            {uploadingGalleryCount > 0 ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6DAEAD]" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 text-[#5C7372]" />
            )}
            <span>
              {uploadingGalleryCount > 0
                ? `Uploading (${uploadingGalleryCount})...`
                : "Add gallery images"}
            </span>
          </button>

          <button
            type="button"
            id="toggle-gallery-url-button"
            onClick={() => setShowGalleryUrlInput(!showGalleryUrlInput)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[#5C7372] hover:text-[#243838] transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{showGalleryUrlInput ? "Hide URL input" : "Add by URL"}</span>
          </button>
        </div>

        {showGalleryUrlInput && (
          <div className="mt-3 flex items-center gap-2 max-w-lg">
            <input
              type="url"
              id="gallery-image-url-input"
              value={galleryUrlValue}
              onChange={(e) => setGalleryUrlValue(e.target.value)}
              placeholder="https://..."
              className="flex-1 text-xs font-mono px-3 py-2 bg-[#F7FBFA] border border-[#D5E6E5] rounded-2xl text-[#243838] placeholder:text-[#6E8887]/60 focus:outline-none focus:border-[#6DAEAD] focus:bg-white transition-colors"
            />
            <button
              type="button"
              id="add-gallery-url-submit-button"
              onClick={handleAddGalleryUrl}
              className="rounded-xl bg-[#6DAEAD] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#5A9998]"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </section>
  );
});
