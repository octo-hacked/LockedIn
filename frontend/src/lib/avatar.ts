function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function hslFromString(str: string) {
  const h = hashCode(str) % 360;
  const s = 60;
  const l = 55;
  return `hsl(${h} ${s}% ${l}%)`;
}

export async function generateAvatarFile(name: string, size = 256): Promise<File> {
  const display = (name || "?").trim();
  const initial = display[0]?.toUpperCase() || "?";
  const bg = hslFromString(display);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Initial
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Dynamic font sizing based on size
  ctx.font = `${Math.floor(size * 0.5)}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif`;
  ctx.fillText(initial, size / 2, size / 2);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create avatar blob"))), "image/png");
  });
  return new File([blob], "avatar.png", { type: "image/png" });
}
