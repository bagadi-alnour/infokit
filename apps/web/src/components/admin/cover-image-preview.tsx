"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useCoverImagePreview(initialSrc: string | null = null) {
  const objectUrlRef = useRef<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState(initialSrc);

  useEffect(() => {
    if (!objectUrlRef.current) setPreviewSrc(initialSrc);
  }, [initialSrc]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const showFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreviewSrc(objectUrl);
  }, []);

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreviewSrc(null);
  }, []);

  return { previewSrc, showFile, clearPreview };
}

export function CoverImagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="border-line bg-subtle aspect-[16/9] overflow-hidden rounded-lg border">
      {/* Signed and object URLs must load directly instead of passing through Next's public image cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        decoding="async"
      />
    </div>
  );
}
