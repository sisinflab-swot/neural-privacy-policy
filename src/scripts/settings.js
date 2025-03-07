/**
 * settings.js
 *
 * Manage extension settings. Includes defaults and merges with user-specified settings
 * stored in chrome.storage.local.
 */

import {devLog} from "./utils.js";

const DEFAULT_SETTINGS = Object.freeze({
    batchSize: 1,
    maxSeqLen: 256,
    modelName: "TinyBERT",
    modelSize: "base",
    useHwAcceleration: true,
    numThreads: 1, // Example: if you want to allow user to set threads
});

/**
 * Fetch settings from chrome.storage.local, falling back to defaults if not set.
 * @returns {Promise<Partial<typeof DEFAULT_SETTINGS>>}
 */
export async function getSettings() {
    try {
        const result = await chrome.storage.local.get(["settings"]);
        if (!result.settings) {
            devLog("No custom settings found. Using defaults.");
            return {...DEFAULT_SETTINGS};
        }
        devLog("Loaded custom settings:", result.settings);
        return result.settings;
    } catch (error) {
        devLog("Error fetching settings from storage:", error);
        return {...DEFAULT_SETTINGS};
    }
}

/**
 * Merge user-provided settings with existing settings, then store them in chrome.storage.
 * @param {object} newSettings
 * @returns {Promise<void>}
 */
export async function setSettings(newSettings) {
    if (typeof newSettings !== "object" || !Object.keys(newSettings).length) {
        throw new Error("Invalid settings object provided.");
    }
    const currentSettings = await getSettings();
    const updatedSettings = {...currentSettings, ...newSettings};
    await chrome.storage.local.set({settings: updatedSettings});
    devLog("Settings saved:", updatedSettings);
}

/**
 * Reset settings to factory defaults.
 * @returns {Promise<void>}
 */
export async function resetSettings() {
    try {
        await chrome.storage.local.set({settings: {...DEFAULT_SETTINGS}});
        devLog("Settings reset to default.");
    } catch (error) {
        devLog("Error resetting settings:", error);
    }
}
