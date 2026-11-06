/** Resize an image file to a square data URL for client brand logos. */
export async function fileToBrandLogoDataUrl(
  file: File,
  size = 512,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Brand logo must be an image (PNG or JPG).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Brand logo must be under 8 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process logo image.");

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();

  // Keep payload small for API JSON body (3mb limit).
  return canvas.toDataURL("image/jpeg", 0.85);
}
