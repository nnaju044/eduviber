import crypto from "node:crypto";

const PLAYER_BASE_URL = "https://player.mediadelivery.net/embed";

function getConfig() {
    const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY,
        BUNNY_STREAM_EMBED_TOKEN_KEY } = process.env;

    if (!BUNNY_STREAM_LIBRARY_ID || !/^\d+$/.test(BUNNY_STREAM_LIBRARY_ID)) {
        throw new Error("Invalid BUNNY_STREAM_LIBRARY_ID");
    }

    if (!BUNNY_STREAM_API_KEY || !BUNNY_STREAM_EMBED_TOKEN_KEY) {
        throw new Error("Missing Bunny Stream credentials");
    }

    return {
        libraryId: BUNNY_STREAM_LIBRARY_ID,
        apiKey: BUNNY_STREAM_API_KEY,
        embedTokenKey: BUNNY_STREAM_EMBED_TOKEN_KEY,
    };
}

export async function verifyBunnyVideo(videoId) {
    if (!/^[0-9a-f-]{36}$/i.test(videoId)) {
        throw new Error("Invalid Bunny video ID format");
    }

    const { libraryId, apiKey } = getConfig();

    const response = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
        {
            headers: {
                AccessKey: apiKey,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(10000),
        }
    );

    if (response.status === 404) {
        return { exists: false };
    }

    if (!response.ok) {
        throw new Error(`Bunny API request failed (${response.status})`);
    }

    const video = await response.json();

    return {
        exists: String(video.videoLibraryId) === libraryId &&
            video.guid === videoId,
        title: video.title,
        durationSeconds: video.length,
        status: video.status,
        encodeProgress: video.encodeProgress,
    };
}

export function createSignedEmbedUrl(videoId, ttlSeconds = 3600) {
    const { libraryId, embedTokenKey } = getConfig();

    if (!/^[0-9a-f-]{36}$/i.test(videoId)) {
        throw new Error("Invalid Bunny video ID format");
    }

    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;

    // Bunny Embed View Token: SHA-256 of key + video ID + expiry.
    const token = crypto
        .createHash("sha256")
        .update(`${embedTokenKey}${videoId}${expires}`)
        .digest("hex");

    const url = new URL(
        `${PLAYER_BASE_URL}/${libraryId}/${videoId}`
    );

    url.searchParams.set("token", token);
    url.searchParams.set("expires", String(expires));

    return url.toString();
}

/**
 * Creates a video entry in Bunny Stream video library
 */
export async function createBunnyVideo(title = "Lesson Video") {
    const { libraryId, apiKey } = getConfig();

    const response = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos`,
        {
            method: "POST",
            headers: {
                AccessKey: apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ title: String(title).slice(0, 150) }),
            signal: AbortSignal.timeout(15000),
        }
    );

    if (!response.ok) {
        throw new Error(`Bunny video creation failed (${response.status})`);
    }

    const data = await response.json();
    return {
        videoId: data.guid,
        title: data.title,
    };
}

/**
 * Uploads video file binary/stream to Bunny Stream
 */
export async function uploadBunnyVideo(videoId, bufferOrStream) {
    if (!/^[0-9a-f-]{36}$/i.test(videoId)) {
        throw new Error("Invalid Bunny video ID format");
    }

    const { libraryId, apiKey } = getConfig();

    const response = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
        {
            method: "PUT",
            headers: {
                AccessKey: apiKey,
                "Content-Type": "application/octet-stream",
            },
            body: bufferOrStream,
            duplex: "half",
            signal: AbortSignal.timeout(60000),
        }
    );

    if (!response.ok) {
        throw new Error(`Bunny video upload failed (${response.status})`);
    }

    return {
        success: true,
        videoId,
    };
}