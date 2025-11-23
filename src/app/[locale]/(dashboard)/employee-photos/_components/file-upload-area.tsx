/* eslint-disable @next/next/no-img-element */
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FiX, FiFolder } from "react-icons/fi";
import { useUploadSinglePhoto } from "../_hooks/use-upload-single-photo";

interface SelectedFile {
  file: File;
  preview: string;
  uploadStatus?: "idle" | "uploading" | "success" | "error";
  uploadError?: string;
}

interface ImageUploaderProps {
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  onError?: (error: string) => void;
  onFolderNameChange?: (folderName: string | null) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizePerFile?: number;
  acceptedFormats?: string[];
  employeeIds?: number[];
  autoUpload?: boolean;
}

export default function ImageUploader({
  selectedFiles,
  onFilesChange,
  onError,
  onFolderNameChange,
  disabled = false,
  acceptedFormats = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
  ],
  employeeIds = [],
  autoUpload = true,
}: ImageUploaderProps) {
  const [processingProgress, setProcessingProgress] = useState<{
    total: number;
    processed: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    uploaded: number;
    failed: number;
  } | null>(null);

  // Use ref to track latest files for upload callbacks
  const filesRef = useRef(selectedFiles);
  useEffect(() => {
    filesRef.current = selectedFiles;
  }, [selectedFiles]);

  // Upload hook
  const uploadMutation = useUploadSinglePhoto({
    onError: (error) => {
      onError?.(error);
    },
  });

  const detectTopLevelFolderName = useCallback(
    (files: File[]): string | null => {
      for (const file of files) {
        const relativePath = (
          file as unknown as { webkitRelativePath?: string }
        ).webkitRelativePath;
        if (relativePath && typeof relativePath === "string") {
          const firstSegment = relativePath.split("/")[0];
          if (firstSegment) return firstSegment;
        }
      }
      return null;
    },
    []
  );

  const validateFiles = useCallback(
    (files: File[]): { validFiles: File[]; errors: string[] } => {
      return { validFiles: files, errors: [] };
    },
    []
  );

  const processFiles = useCallback(
    (files: File[], folderNameOverride?: string | null) => {
      if (files.length === 0) {
        onError?.("Please select at least one image file");
        return;
      }

      const detectedFolder =
        folderNameOverride ?? detectTopLevelFolderName(files);
      if (!detectedFolder) {
        onFolderNameChange?.(null);
        return;
      }
      if (detectedFolder.length < 5) {
        onError?.(
          "Folder name must have at least 5 characters to extract barcode prefix"
        );
        onFolderNameChange?.(null);
        return;
      }

      const barcodePrefix = detectedFolder.slice(-5);
      onFolderNameChange?.(barcodePrefix);

      const { validFiles, errors } = validateFiles(files);

      if (errors.length > 0) {
        onError?.(errors.join(", "));
      }

      if (validFiles.length === 0) {
        return;
      }

      // Create previews in batches to avoid blocking UI
      const batchSize = 20;
      const newFiles: SelectedFile[] = [];
      const totalFiles = validFiles.length;

      // Initialize progress tracking
      setProcessingProgress({ total: totalFiles, processed: 0 });
      if (autoUpload && employeeIds.length > 0) {
        setUploadProgress({ total: totalFiles, uploaded: 0, failed: 0 });
      }

      const processBatch = (startIndex: number) => {
        const endIndex = Math.min(startIndex + batchSize, validFiles.length);

        for (let i = startIndex; i < endIndex; i++) {
          const newFile: SelectedFile = {
            file: validFiles[i],
            preview: URL.createObjectURL(validFiles[i]),
            uploadStatus: "idle",
          };
          newFiles.push(newFile);
        }

        const processedCount = endIndex;
        const currentNewFiles = [...selectedFiles, ...newFiles];

        // Update progress
        setProcessingProgress({ total: totalFiles, processed: processedCount });

        // Update UI with current batch
        onFilesChange(currentNewFiles);

        // Upload each new file if autoUpload is enabled
        if (autoUpload && employeeIds.length > 0 && barcodePrefix) {
          newFiles.forEach((newFile, batchIndex) => {
            const globalIndex = selectedFiles.length + startIndex + batchIndex;

            // Queue the upload (will be processed sequentially)
            uploadMutation.mutate(
              {
                photo: newFile.file,
                barcodePrefix: barcodePrefix,
                employeeIds: employeeIds,
              },
              {
                onSuccess: () => {
                  // Update status to success
                  const successFiles = [...filesRef.current];
                  if (successFiles[globalIndex]) {
                    successFiles[globalIndex] = {
                      ...successFiles[globalIndex],
                      uploadStatus: "success",
                      uploadError: undefined,
                    };
                    onFilesChange(successFiles);
                  }

                  // Update progress
                  setUploadProgress((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      uploaded: prev.uploaded + 1,
                    };
                  });
                },
                onError: (error: Error) => {
                  // Update status to error
                  const errorFiles = [...filesRef.current];
                  if (errorFiles[globalIndex]) {
                    errorFiles[globalIndex] = {
                      ...errorFiles[globalIndex],
                      uploadStatus: "error",
                      uploadError: error.message,
                    };
                    onFilesChange(errorFiles);
                  }

                  // Update progress
                  setUploadProgress((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      failed: prev.failed + 1,
                    };
                  });
                },
              }
            );

            // Immediately update status to uploading for first item only
            if (globalIndex === selectedFiles.length) {
              setTimeout(() => {
                const uploadingFiles = [...filesRef.current];
                if (uploadingFiles[globalIndex]) {
                  uploadingFiles[globalIndex] = {
                    ...uploadingFiles[globalIndex],
                    uploadStatus: "uploading",
                  };
                  onFilesChange(uploadingFiles);
                }
              }, 50);
            }
          });
        }

        // Process next batch if there are more files
        if (endIndex < validFiles.length) {
          setTimeout(() => processBatch(endIndex), 0);
        } else {
          // All files processed, clear processing progress after a short delay
          setTimeout(() => {
            setProcessingProgress(null);
          }, 500);
        }
      };

      processBatch(0);
    },
    [
      selectedFiles,
      validateFiles,
      onError,
      onFilesChange,
      detectTopLevelFolderName,
      onFolderNameChange,
      autoUpload,
      employeeIds,
      uploadMutation,
    ]
  );

  // Watch for status changes to update "uploading" status
  useEffect(() => {
    const uploadingIndex = selectedFiles.findIndex(
      (f) => f.uploadStatus === "uploading"
    );
    const nextIdleIndex = selectedFiles.findIndex(
      (f) => f.uploadStatus === "idle"
    );

    // If current uploading item finished, mark next idle as uploading
    if (uploadingIndex === -1 && nextIdleIndex !== -1) {
      setTimeout(() => {
        const updatedFiles = [...filesRef.current];
        if (
          updatedFiles[nextIdleIndex] &&
          updatedFiles[nextIdleIndex].uploadStatus === "idle"
        ) {
          updatedFiles[nextIdleIndex] = {
            ...updatedFiles[nextIdleIndex],
            uploadStatus: "uploading",
          };
          onFilesChange(updatedFiles);
        }
      }, 100);
    }
  }, [selectedFiles, onFilesChange]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      processFiles(files);
      event.target.value = "";
    },
    [processFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = [...selectedFiles];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      onFilesChange(newFiles);
    },
    [selectedFiles, onFilesChange]
  );

  const clearAllFiles = useCallback(() => {
    // Clear upload queue
    uploadMutation.clearQueue();

    // Revoke all preview URLs
    selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));

    // Reset all state
    onFilesChange([]);
    onFolderNameChange?.(null);
    setProcessingProgress(null);
    setUploadProgress(null);
  }, [selectedFiles, onFilesChange, onFolderNameChange, uploadMutation]);

  // Memoize grid to prevent unnecessary re-renders
  const imageGrid = useMemo(() => {
    return selectedFiles.map((selectedFile, index) => {
      const getStatusColor = () => {
        switch (selectedFile.uploadStatus) {
          case "uploading":
            return "border-yellow-400";
          case "success":
            return "border-green-400";
          case "error":
            return "border-red-400";
          default:
            return "border-gray-200";
        }
      };

      const getStatusIcon = () => {
        switch (selectedFile.uploadStatus) {
          case "uploading":
            return (
              <div className="absolute top-1 left-1 bg-yellow-500 text-white rounded-full p-1">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            );
          case "success":
            return (
              <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1">
                <span className="text-xs">✓</span>
              </div>
            );
          case "error":
            return (
              <div className="absolute top-1 left-1 bg-red-500 text-white rounded-full p-1">
                <span className="text-xs">✕</span>
              </div>
            );
          default:
            return null;
        }
      };

      return (
        <div key={index} className="relative group">
          <div
            className={`aspect-square overflow-hidden rounded-lg border-2 ${getStatusColor()} hover:border-blue-300 transition-colors`}
          >
            <img
              src={selectedFile.preview}
              alt={`Preview ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {getStatusIcon()}
          </div>
          <button
            type="button"
            onClick={() => removeFile(index)}
            className="absolute -top-0 -right-0 bg-red-500 text-white rounded-full p-.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
            disabled={disabled}
            title="Remove image"
          >
            <FiX size={14} />
          </button>
          {selectedFile.uploadError && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs p-1 truncate">
              {selectedFile.uploadError}
            </div>
          )}
        </div>
      );
    });
  }, [selectedFiles, disabled, removeFile]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="relative z-0">
          <input
            type="file"
            multiple
            accept={acceptedFormats.join(",")}
            onChange={handleFileSelect}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            {...({
              webkitdirectory: "",
              directory: "",
            } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100">
            <FiFolder size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              Select Entire Folder
            </p>
            <p className="text-xs text-gray-500">
              Choose a folder containing images (last 5 characters of folder
              name will be used as barcode prefix)
            </p>
          </div>
        </div>
      </div>

      {processingProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">
              Processing images: {processingProgress.processed} /{" "}
              {processingProgress.total}
            </span>
            {processingProgress.processed === processingProgress.total && (
              <span className="text-green-600 font-medium">✓ All rendered</span>
            )}
          </div>
          <Progress
            value={
              (processingProgress.processed / processingProgress.total) * 100
            }
            className="h-2"
          />
        </div>
      )}

      {uploadProgress && uploadProgress.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">
              Uploading: {uploadProgress.uploaded} / {uploadProgress.total}
              {uploadProgress.failed > 0 && (
                <span className="text-red-600 ml-2">
                  ({uploadProgress.failed} failed)
                </span>
              )}
            </span>
            {uploadProgress.uploaded + uploadProgress.failed ===
              uploadProgress.total && (
              <span className="text-green-600 font-medium">✓ All uploaded</span>
            )}
          </div>
          <Progress
            value={
              ((uploadProgress.uploaded + uploadProgress.failed) /
                uploadProgress.total) *
              100
            }
            className="h-2"
          />
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium">
              Selected Photos ({selectedFiles.length})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAllFiles}
              disabled={disabled}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear All
            </Button>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-80 overflow-y-auto">
              {imageGrid}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
