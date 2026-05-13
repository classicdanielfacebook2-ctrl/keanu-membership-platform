import { put } from "@vercel/blob";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const loadLocalEnv = async () => {
  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const envFile = await readFile(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    process.env[key.trim()] ||= value;
  }
};

const homeVideos = [
  {
    id: "top-video-advert-downloaded",
    title: "John Wick: Chapter 4 Official Trailer",
    path: "public/media/review-videos/top-video-advert.mp4",
    contentType: "video/mp4"
  },
  {
    id: "main-video-banner-downloaded",
    title: "John Wick: Chapter 4 Behind-the-Scenes Stunt Clip",
    path: "public/media/review-videos/main-video-banner-replacement-combined.mp4",
    contentType: "video/mp4"
  },
  {
    id: "interview-preview-downloaded",
    title: "WIRED Autocomplete Interview",
    path: "public/media/review-videos/interview-preview.mp4",
    contentType: "video/mp4"
  },
  {
    id: "membership-campaign-preview-downloaded",
    title: "John Wick: Chapter 4 Red Carpet Clip",
    path: "public/media/review-videos/membership-campaign-preview.mp4",
    contentType: "video/mp4"
  }
];

const homeImages = [
  {
    id: "official-portrait",
    path: "public/media/review-images/keanu-reeves-2019.jpg",
    contentType: "image/jpeg"
  },
  {
    id: "campaign-still",
    path: "public/media/review-images/keanu-reeves-2014.jpg",
    contentType: "image/jpeg"
  },
  {
    id: "membership-lifestyle",
    path: "public/media/review-images/keanu-fantastic-fest-2013.jpg",
    contentType: "image/jpeg"
  },
  {
    id: "press-photo",
    path: "public/media/review-images/keanu-reeves-2019-cropped.jpg",
    contentType: "image/jpeg"
  }
];

const assertToken = () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required. Add it from Vercel Blob before running this upload.");
  }
};

const uploadItems = async (items, folder) => {
  const manifest = {};

  for (const item of items) {
    const absolutePath = join(rootDir, item.path);
    if (!existsSync(absolutePath)) {
      console.warn(`Skipping missing file: ${item.path}`);
      continue;
    }

    const body = await readFile(absolutePath);
    const extension = extname(item.path);
    const pathname = `keanu-membership/${folder}/${item.id}${extension}`;
    const blob = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      contentType: item.contentType
    });

    manifest[item.id] = {
      url: blob.url,
      uploadedAt: new Date().toISOString(),
      sourceFile: item.path
    };
    console.log(`Uploaded ${item.id}: ${blob.url}`);
  }

  return manifest;
};

const writeManifest = async (relativePath, exportName, manifest) => {
  const target = join(rootDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  const file = `export const ${exportName} = ${JSON.stringify(manifest, null, 2)};\n`;
  await writeFile(target, file);
};

await loadLocalEnv();
assertToken();

const videoManifest = await uploadItems(homeVideos, "videos");
const imageManifest = await uploadItems(homeImages, "images");

await writeManifest("src/data/blobHomeVideos.js", "blobHomeVideos", videoManifest);
await writeManifest("src/data/blobHomeImages.js", "blobHomeImages", imageManifest);

console.log("Vercel Blob media manifests updated.");
