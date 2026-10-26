// Records a page to MP4 with Chrome's screencast (Synpress's MetaMask context has no video option) and
// shows on-screen captions, so the demo recording explains itself.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export async function startScreencast(page: Page, framesDir: string) {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const frames: { file: string; t: number }[] = [];
  // Steady screenshots rather than CDP's screencast, which only sends frames when Chrome sees "damage"
  // and skipped overlay changes like captions.
  let recording = true;
  const loop = (async () => {
    while (recording) {
      // absolute: ffmpeg resolves concat-list paths relative to the list file
      const file = path.resolve(framesDir, `f${String(frames.length).padStart(5, "0")}.jpg`);
      const t = Date.now() / 1000;
      const ok = await page.screenshot({ path: file, type: "jpeg", quality: 85 }).then(() => true, () => false);
      if (ok) frames.push({ file, t });
      await new Promise((r) => setTimeout(r, 120)); // ~5 frames a second
    }
  })();

  /** Stops recording and writes an MP4 where each frame lasts as long as it was on screen. */
  return async function stop(outFile: string) {
    recording = false;
    await loop;
    if (frames.length < 2) throw new Error("screencast captured no frames");
    const list = frames.map((f, i) => {
      const next = frames[i + 1]?.t ?? f.t + 2; // hold the last frame for 2s
      return `file '${f.file.replaceAll("\\", "/")}'\nduration ${Math.max(0.01, next - f.t).toFixed(3)}`;
    });
    const listFile = path.join(framesDir, "frames.txt");
    fs.writeFileSync(listFile, `${list.join("\n")}\nfile '${frames.at(-1)!.file.replaceAll("\\", "/")}'\n`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-r", "30", "-c:v", "libx264", "-crf", "20", outFile]);
    return frames.length;
  };
}

/** A caption bar along the bottom of the page. Re-added after full page loads. */
export async function caption(page: Page, text: string, holdMs = 2500) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:min(1100px,90vw);" +
        "padding:14px 22px;border-radius:16px;background:rgba(11,11,12,.92);color:#fff;font:600 20px/1.35 Switzer,system-ui,sans-serif;" +
        "border:1px solid rgba(158,252,101,.55);box-shadow:0 18px 40px -12px rgba(0,0,0,.45);text-align:center;pointer-events:none;transition:opacity .2s";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(holdMs);
}

/** Draws a lime ring around an element for a moment, to point at it. */
export async function point(page: Page, selector: string, holdMs = 1800) {
  await page.locator(selector).first().evaluate((el, ms) => {
    const prev = (el as HTMLElement).style.boxShadow;
    (el as HTMLElement).style.boxShadow = "0 0 0 4px #9efc65, 0 0 0 9px rgba(158,252,101,.35)";
    setTimeout(() => ((el as HTMLElement).style.boxShadow = prev), ms);
  }, holdMs);
  await page.waitForTimeout(holdMs);
}

/** Scrolls smoothly so the motion reads well on video. */
export async function glide(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  await page.waitForTimeout(1400);
}
