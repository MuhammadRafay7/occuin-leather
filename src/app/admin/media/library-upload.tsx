"use client";

import { useRouter } from "next/navigation";
import { UploadButton } from "./upload-button";

export function LibraryUpload() {
  const router = useRouter();
  return <UploadButton label="Upload photos" hint={false} primary onUploaded={() => router.refresh()} />;
}
