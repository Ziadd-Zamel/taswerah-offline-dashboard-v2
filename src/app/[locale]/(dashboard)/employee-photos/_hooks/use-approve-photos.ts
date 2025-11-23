import { useMutation } from "@tanstack/react-query";
import { approvePhoto } from "../_actions/approve-photo";
import { toast } from "sonner";
export const useApprovePhotos = ({ onClose }: { onClose?: () => void }) => {
  return useMutation({
    mutationFn: async () => {
      const result = await approvePhoto();

      if (!result.ok) {
        throw new Error(result.message);
      }

      return result;
    },

    onSuccess: () => {
      toast.success("Images approved successfully");
      if (onClose) {
        onClose();
      }
    },

    onError: (error) => {
      console.log(error.message);
      toast.error(error.message);
    },
  });
};
