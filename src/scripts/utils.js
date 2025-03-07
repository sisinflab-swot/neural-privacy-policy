/**
 * utils.js
 *
 * Shared utility functions, including a conditional logger that only logs in development mode.
 */

export function devLog(...args) {
    if (process.env.NODE_ENV === "development") {
        console.log(...args);
    }
}

/**
 * Download a file from the given URL as a Blob.
 * The `onProgress` callback is called with a fractional progress [0..1] if
 * the response supplies a `Content-Length` header.
 *
 * @param {string} url - URL from which to download the file. It must be a direct link.
 * @param {(pct: number) => void} [onProgress] - Optional progress callback.
 * @returns {Promise<Blob>} - The downloaded file as a Blob.
 */
export async function downloadFile(url, onProgress) {
    devLog("Starting download from", url);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file from ${url}. Status: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;
    let loadedBytes = 0;

    const reader = response.body.getReader();

    // Create a ReadableStream that monitors the loading progress
    const progressStream = new ReadableStream({
        async start(controller) {
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    controller.close();
                    break;
                }
                loadedBytes += value.length;
                if (onProgress && totalSize !== null) {
                    onProgress((loadedBytes / totalSize).toFixed(2)); // fractional progress
                }
                controller.enqueue(value);
            }
        },
    });

    const progressResponse = new Response(progressStream);
    const arrayBuffer = await progressResponse.arrayBuffer();

    // Create and return the downloaded blob
    return new Blob([arrayBuffer], {type: contentType});
}
