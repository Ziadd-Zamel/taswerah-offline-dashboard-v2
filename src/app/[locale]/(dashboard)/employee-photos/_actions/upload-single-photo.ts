interface UploadResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function uploadSinglePhotoAction(
  formData: FormData
): Promise<UploadResponse> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API}/temp/upload-photo`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.ok) {
      return {
        success: true,
        message: "Photo uploaded successfully!",
      };
    } else {
      const errorData = await response.text();
      console.log(errorData);
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}`,
      };
    }
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
