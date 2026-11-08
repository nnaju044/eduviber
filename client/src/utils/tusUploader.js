/**
 * Browser-native TUS client implementation for direct resumable uploads
 * to Bunny Stream (https://video.bunnycdn.com/tusupload).
 *
 * Implements core TUS 1.0.0 protocol:
 * - POST to create upload session with pre-signed Bunny authorization headers and Upload-Metadata
 * - HEAD to check existing upload offset for resumption
 * - PATCH to stream byte chunks with Upload-Offset
 * - Real-time progress, upload speed (MB/s), and pause/abort/retry handling
 */

function encodeMetadata(metadata) {
  return Object.entries(metadata)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      const b64 = btoa(unescape(encodeURIComponent(String(v))));
      return `${k} ${b64}`;
    })
    .join(",");
}

export class BunnyTusUploader {
  constructor(file, options = {}) {
    this.file = file;
    this.endpoint = options.endpoint || "https://video.bunnycdn.com/tusupload";
    this.auth = options.auth || {}; // { videoId, libraryId, signature, expirationTime }
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5 MB chunks for reliable streaming
    this.onProgress = options.onProgress || (() => {});
    this.onSuccess = options.onSuccess || (() => {});
    this.onError = options.onError || (() => {});

    this.aborted = false;
    this.uploadUrl = null;
    this.offset = 0;
    this.lastUploadedBytes = 0;
    this.lastProgressTime = Date.now();
  }

  getAuthHeaders() {
    return {
      "Tus-Resumable": "1.0.0",
      AuthorizationSignature: this.auth.signature,
      AuthorizationExpire: String(this.auth.expirationTime),
      LibraryId: String(this.auth.libraryId),
      VideoId: String(this.auth.videoId),
    };
  }

  abort() {
    this.aborted = true;
    if (this.currentXhr) {
      try {
        this.currentXhr.abort();
      } catch (_) {}
    }
  }

  async start() {
    try {
      this.aborted = false;
      this.lastProgressTime = Date.now();
      this.lastUploadedBytes = 0;

      // 1. Check local storage for previous session if available
      const storageKey = `eduviber_tus_${this.auth.libraryId}_${this.auth.videoId}`;
      const savedUrl = localStorage.getItem(storageKey);

      if (savedUrl) {
        try {
          const offset = await this.queryOffset(savedUrl);
          if (offset >= 0 && offset < this.file.size) {
            this.uploadUrl = savedUrl;
            this.offset = offset;
            await this.uploadChunks();
            return;
          } else if (offset === this.file.size) {
            this.onProgress({
              bytesUploaded: this.file.size,
              bytesTotal: this.file.size,
              percentage: 100,
              speedMBps: 0,
            });
            this.onSuccess({ videoId: this.auth.videoId });
            return;
          }
        } catch (_) {
          // If check fails, fall through to creation
          localStorage.removeItem(storageKey);
        }
      }

      // 2. Initialize new upload session via POST
      this.uploadUrl = await this.createSession();
      try {
        localStorage.setItem(storageKey, this.uploadUrl);
      } catch (_) {}

      // 3. Upload chunks
      await this.uploadChunks();

      try {
        localStorage.removeItem(storageKey);
      } catch (_) {}
    } catch (err) {
      if (!this.aborted) {
        this.onError(err);
      }
    }
  }

  createSession() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.currentXhr = xhr;

      xhr.open("POST", this.endpoint, true);

      const headers = this.getAuthHeaders();
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }

      xhr.setRequestHeader("Upload-Length", String(this.file.size));

      const metadata = encodeMetadata({
        filetype: this.file.type || "video/mp4",
        title: this.file.name || "Lesson Video",
      });
      xhr.setRequestHeader("Upload-Metadata", metadata);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const location = xhr.getResponseHeader("Location");
          if (!location) {
            reject(new Error("Upload creation failed: Missing Location header from server."));
            return;
          }
          // Resolve relative or absolute location
          const resolvedUrl = new URL(location, this.endpoint).toString();
          resolve(resolvedUrl);
        } else {
          reject(
            new Error(`TUS upload creation failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`)
          );
        }
      };

      xhr.onerror = () => reject(new Error("Network connection error initializing upload."));
      xhr.send();
    });
  }

  queryOffset(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.currentXhr = xhr;

      xhr.open("HEAD", url, true);
      const headers = this.getAuthHeaders();
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const offsetStr = xhr.getResponseHeader("Upload-Offset");
          if (offsetStr !== null) {
            resolve(parseInt(offsetStr, 10));
          } else {
            reject(new Error("Missing Upload-Offset header in HEAD response"));
          }
        } else {
          reject(new Error(`Failed to check upload offset: HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error checking upload status"));
      xhr.send();
    });
  }

  async uploadChunks() {
    while (this.offset < this.file.size && !this.aborted) {
      const start = this.offset;
      const end = Math.min(start + this.chunkSize, this.file.size);
      const chunk = this.file.slice(start, end);

      await this.sendChunk(chunk, start, end);
      this.offset = end;
    }

    if (!this.aborted) {
      this.onProgress({
        bytesUploaded: this.file.size,
        bytesTotal: this.file.size,
        percentage: 100,
        speedMBps: 0,
      });
      this.onSuccess({ videoId: this.auth.videoId });
    }
  }

  sendChunk(chunk, chunkStart, chunkEnd) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.currentXhr = xhr;

      xhr.open("PATCH", this.uploadUrl, true);

      const headers = this.getAuthHeaders();
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }

      xhr.setRequestHeader("Upload-Offset", String(chunkStart));
      xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const currentTotalUploaded = chunkStart + e.loaded;
          const now = Date.now();
          const elapsedSec = (now - this.lastProgressTime) / 1000;

          let speedMBps = 0;
          if (elapsedSec >= 0.5) {
            const bytesSinceLast = currentTotalUploaded - this.lastUploadedBytes;
            speedMBps = bytesSinceLast / (1024 * 1024 * elapsedSec);
            this.lastProgressTime = now;
            this.lastUploadedBytes = currentTotalUploaded;
          }

          const percentage = Math.min(
            100,
            parseFloat(((currentTotalUploaded / this.file.size) * 100).toFixed(1))
          );

          this.onProgress({
            bytesUploaded: currentTotalUploaded,
            bytesTotal: this.file.size,
            percentage,
            speedMBps: parseFloat(speedMBps.toFixed(2)),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const nextOffset = xhr.getResponseHeader("Upload-Offset");
          if (nextOffset) {
            this.offset = parseInt(nextOffset, 10);
          }
          resolve();
        } else {
          reject(new Error(`TUS chunk upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network connection error during chunk upload."));
      xhr.send(chunk);
    });
  }
}
