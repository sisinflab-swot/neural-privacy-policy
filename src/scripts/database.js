/**
 * database.js
 *
 * A minimal IndexedDB wrapper for storing and retrieving blobs, e.g., model weights
 * or tokenizer files. Each function returns a Promise.
 */

import {devLog} from "./utils.js";

/**
 * Read a Blob from IndexedDB by a given key.
 * @param {string} key
 * @returns {Promise<Blob | null>}
 */
export function readBlob(key) {
    devLog("Reading IndexedDB blob with key:", key);
    return new Promise((resolve, reject) => {
        let request = indexedDB.open("models", 3);

        request.onupgradeneeded = function (event) {
            let db = event.target.result;
            if (db.objectStoreNames.contains("models")) {
                db.deleteObjectStore("models");
            }
            db.createObjectStore("models");
        };

        request.onsuccess = function (event) {
            let db = event.target.result;
            let transaction = db.transaction("models", "readonly");
            let objectStore = transaction.objectStore("models");
            let getRequest = objectStore.get(key);

            getRequest.onsuccess = function () {
                if (getRequest.result !== undefined) {
                    resolve(getRequest.result);
                } else {
                    resolve(null);
                }
            };

            getRequest.onerror = function (event) {
                reject(event.target.error);
            };
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

/**
 * Write a Blob into IndexedDB using a specific key.
 * @param {string} key
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
export function writeBlob(key, blob) {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open("models", 3);

        request.onupgradeneeded = function (event) {
            let db = event.target.result;
            if (db.objectStoreNames.contains("models")) {
                db.deleteObjectStore("models");
            }
            db.createObjectStore("models");
        };

        request.onsuccess = function (event) {
            let db = event.target.result;
            let transaction = db.transaction("models", "readwrite");
            let objectStore = transaction.objectStore("models");
            let putRequest = objectStore.put(blob, key);

            putRequest.onsuccess = function () {
                resolve();
            };

            putRequest.onerror = function (event) {
                reject(event.target.error);
            };
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

/**
 * Delete a Blob from IndexedDB for a given key.
 * @param {string} key
 * @returns {Promise<void>}
 */
export function deleteBlob(key) {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open("models", 3);

        request.onupgradeneeded = function (event) {
            let db = event.target.result;
            if (db.objectStoreNames.contains("models")) {
                db.deleteObjectStore("models");
            }
            db.createObjectStore("models");
        };

        request.onsuccess = function (event) {
            let db = event.target.result;
            let transaction = db.transaction("models", "readwrite");
            let objectStore = transaction.objectStore("models");
            let deleteRequest = objectStore.delete(key);

            deleteRequest.onsuccess = function () {
                resolve();
            };

            deleteRequest.onerror = function (event) {
                reject(event.target.error);
            };
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

/**
 * Retrieve all Blobs whose keys start with the given prefix.
 * Returns an object map (without the prefix).
 * @param {string} prefix
 * @returns {Promise<Record<string, Blob>>}
 */
export function getAllBlobsWithPrefix(prefix) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("models", 3);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (db.objectStoreNames.contains("models")) {
                db.deleteObjectStore("models");
            }
            db.createObjectStore("models");
        };

        request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction("models", "readonly");
            const objectStore = transaction.objectStore("models");

            const blobs = {};
            const openCursorRequest = objectStore.openCursor();

            openCursorRequest.onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    const key = cursor.key;
                    if (key.startsWith(prefix)) {
                        blobs[key.replace(prefix, "")] = cursor.value;
                    }
                    cursor.continue();
                } else {
                    // All entries have been iterated
                    resolve(blobs);
                }
            };

            openCursorRequest.onerror = function () {
                reject("Failed to retrieve blobs from IndexedDB.");
            };
        };

        request.onerror = function () {
            reject("Failed to open IndexedDB.");
        };
    });
}

/**
 * Check if a key exists in the IndexedDB.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export function checkKeyExists(key) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("models", 3);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (db.objectStoreNames.contains("models")) {
                db.deleteObjectStore("models");
            }
            db.createObjectStore("models");
        };

        request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction("models", "readonly");
            const objectStore = transaction.objectStore("models");

            const getKeyRequest = objectStore.getKey(key);

            getKeyRequest.onsuccess = function (evt) {
                resolve(evt.target.result !== undefined);
            };

            getKeyRequest.onerror = function () {
                reject("Failed to check key existence in IndexedDB.");
            };
        };

        request.onerror = function () {
            reject("Failed to open IndexedDB.");
        };
    });
}
