# Vercel Blob Media Setup

Large review videos and downloaded photos are not committed to Git. Upload them to Vercel Blob, then commit the generated manifest files.

## 1. Add a Vercel Blob store

In Vercel, open the project, create or connect a Blob store, then copy the `BLOB_READ_WRITE_TOKEN`.

## 2. Add the token locally

PowerShell:

```powershell
$env:BLOB_READ_WRITE_TOKEN="your_vercel_blob_read_write_token"
```

## 3. Upload media

```bash
npm run upload:media
```

This uploads files from:

- `public/media/review-videos/`
- `public/media/review-images/`

Then it updates:

- `src/data/blobHomeVideos.js`
- `src/data/blobHomeImages.js`

## 4. Commit and deploy

```bash
npm run build
git add src/data/blobHomeVideos.js src/data/blobHomeImages.js package.json package-lock.json
git commit -m "Use Vercel Blob for home media"
git push origin main
```

The public Home page prefers Vercel Blob URLs. Before Blob upload, the local review build uses the downloaded MP4 files in `public/media/review-videos/`.
