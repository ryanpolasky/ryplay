const CANVAS_SIZE = 64;

let canvas: HTMLCanvasElement | null = null;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
  }
  return canvas;
}

export function setGradientFavicon(from: string, to: string) {
  const c = getCanvas();
  const ctx = c.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);

  ctx.fillStyle = grad;
  ctx.font = "bold 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Measure actual glyph bounds to find true visual center
  const metrics = ctx.measureText("ry");
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const glyphHeight = ascent + descent;
  const y = (CANVAS_SIZE + glyphHeight) / 2 - descent;

  ctx.fillText("ry", CANVAS_SIZE / 2, y + 3);

  const url = c.toDataURL("image/png");

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = url;
}
