# Upload Module

- **Owner**: Core Services Team
- **Dependencies**: Auth Module
- **Related Documents**: None

## Purpose

Provide a unified file upload service supporting images (profile photos, product images, content images) and videos (exercise demonstrations). Handles file validation, storage to Cloudinary (production) or local filesystem (development/temp), and returns access URLs.

## Models

- **Upload**: Generic file record. Fields include id, originalFilename, storedFilename, mimeType, size (bytes), url, provider (cloudinary, local), providerMetadata (provider-specific IDs), uploadedBy (userId), referenceType (profile, product, content, exercise), referenceId (optional FK to related entity), and timestamps.

## Services

- **uploadService**: Handles the complete upload lifecycle. Validates file type and size against per-category limits, generates sanitized filenames, uploads to the configured provider, persists the Upload record, and returns the public URL. Supports deletion (single and bulk by reference). Implements cleanup routines for unused uploads and temporary files.

### File Type and Size Limits

| Category | Allowed Types | Max Size | Notes |
|----------|---------------|----------|-------|
| Profile photo | jpg, jpeg, png, webp | 5 MB | Cropped to square server-side |
| Product image | jpg, jpeg, png, webp | 5 MB | Multiple images per product |
| Content image | jpg, jpeg, png, webp, gif | 5 MB | Embedded in rich text content |
| Exercise video | mp4, webm, mov | 50 MB | Exercise demonstration content |

### Storage Providers

- **Cloudinary** (production): Primary storage for all uploads. Provides image transformations (resize, crop, format conversion), CDN delivery, and automatic optimization. Videos served via Cloudinary's video player.
- **Local** (development): Files stored under `storage/uploads/` with date-based directory structure. Served directly by the application server. Temporary — for development and testing only.

## Key Flows

1. **Upload File**: Client sends multipart file → uploadService validates type + size → generates unique filename → uploads to provider → creates Upload record → returns URL and ID.
2. **Delete File**: Client requests deletion → uploadService deletes from provider → removes database record.
3. **Cleanup Orphaned Uploads**: Scheduled job runs periodically → finds Upload records with no referenceId older than 24 hours → deletes from provider and database.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /upload | User | Upload file (multipart/form-data) |
| GET | /upload/:id | User | Get upload metadata |
| DELETE | /upload/:id | User | Delete own upload |
| DELETE | /upload/:id/admin | Admin | Delete any upload |

Query parameters for POST /upload: `category` (profile, product, content, exercise) — determines validation rules. Optional: `referenceType` and `referenceId` for associating with an entity on upload.

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| UPL_001 | File type not allowed | File extension does not match allowed types for category |
| UPL_002 | File too large | File exceeds size limit for the specified category |
| UPL_003 | Upload failed | Provider returned an error during upload |
| UPL_004 | Upload not found | Upload ID does not exist |
| UPL_005 | Invalid category | Specified upload category does not exist |
| UPL_006 | Provider unavailable | Storage provider is not accessible |

## Future

- Video transcoding (HLS streaming for exercise videos)
- Direct upload from URL (fetch remote file and store)
- Image compression presets per category
- Drag-and-drop chunked upload for large videos
- Upload usage quotas per user/role
