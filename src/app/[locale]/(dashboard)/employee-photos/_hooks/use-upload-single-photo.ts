import { useRef, useCallback } from "react";
import { uploadSinglePhotoAction } from "../_actions/upload-single-photo";

interface UploadSinglePhotoData {
  photo: File;
  barcodePrefix: string;
  employeeIds: number[];
}

interface UseUploadSinglePhotoOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface UploadQueueItem {
  data: UploadSinglePhotoData;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export const useUploadSinglePhoto = ({
  onSuccess,
  onError,
}: UseUploadSinglePhotoOptions = {}) => {
  const queueRef = useRef<UploadQueueItem[]>([]);
  const isProcessingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) break;

      try {
        // Create FormData
        const formData = new FormData();
        formData.append("photo", item.data.photo);
        formData.append("barcode_prefix", item.data.barcodePrefix);

        item.data.employeeIds.forEach((employeeId) => {
          formData.append("employee_id", employeeId.toString());
        });

        const result = await uploadSinglePhotoAction(formData);

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        item.onSuccess();
      } catch (error) {
        item.onError(error as Error);
      }

      // Small delay between uploads
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    isProcessingRef.current = false;
  }, []);

  const mutate = useCallback(
    (
      data: UploadSinglePhotoData,
      callbacks?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      }
    ) => {
      const queueItem: UploadQueueItem = {
        data,
        onSuccess: () => {
          callbacks?.onSuccess?.();
          onSuccess?.();
        },
        onError: (error: Error) => {
          callbacks?.onError?.(error);
          onError?.(error.message);
        },
      };

      queueRef.current.push(queueItem);
      processQueue();
    },
    [processQueue, onSuccess, onError]
  );

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    isProcessingRef.current = false;
  }, []);

  return {
    mutate,
    clearQueue,
    isLoading: isProcessingRef.current,
  };
};
