/**
 * settings_ui.js
 *
 * The UI script for your Settings page.
 * Manages the DOM, handles user changes, triggers downloads if a model is missing, etc.
 */

import {devLog, downloadFile} from "./utils.js";
import {getSettings, resetSettings, setSettings} from "./settings.js";
import {checkKeyExists, writeBlob} from "./database.js";
import ProgressBar from "progressbar.js";

// This JSON maps modelName -> modelSize -> { model, tokenizer: {...} }
// Example location: 'models.json' in the extension folder
let mirrors = null;
let settings = null;

let bar = new ProgressBar.Line("#progress-bar-container", {
    strokeWidth: 4,
    easing: "easeInOut",
    color: "#3A8DFF",
    text: {
        style: {
            color: "#999",
            position: "absolute",
            right: "0",
            top: "30px",
            padding: 0,
            margin: 0,
            transform: null,
        },
        autoStyleContainer: false,
    },
});

/**
 * Update progress bar and status message.
 * @param {number} value - Progress fraction (0..1).
 * @param {string} message - Status text to display.
 */
function updateStatus(value, message) {
    bar.animate(value, {duration: 200});
    document.getElementById("status-message").textContent = message;
}

/**
 * Load 'models.json' which contains references to model files and tokenizer files.
 */
async function loadMirrors() {
    try {
        const response = await fetch("./models.json");
        mirrors = await response.json();
        devLog("Loaded mirrors:", mirrors);
    } catch (error) {
        devLog("Error fetching mirrors:", error);
    }
}

/**
 * Populate the 'model size' <select> with relevant sizes for the selected model.
 * @param {string} modelName
 */
function loadModelSizes(modelName) {
    const modelSizeSelect = document.getElementById("settings-model-size");
    modelSizeSelect.options.length = 0;

    for (let modelSize in mirrors[modelName]) {
        modelSizeSelect.options.add(new Option(modelSize, modelSize));
    }
    modelSizeSelect.selectedIndex = 0;
}

/**
 * Check if a model is already downloaded (model file + tokenizer files).
 * @param {string} modelName
 * @param {string} modelSize
 * @returns {Promise<boolean>} True if model files exist locally.
 */
async function checkModelExists(modelName, modelSize) {
    devLog("Checking model files for", modelName, modelSize);
    const modelData = mirrors[modelName][modelSize];
    const requiredFiles = Object.keys(modelData.tokenizer);

    // Check tokenizer files
    for (let file of requiredFiles) {
        const exists = await checkKeyExists(`${modelName}/${modelSize}/${file}`);
        if (!exists) return false;
    }

    // Check the main model weights
    return checkKeyExists(`${modelName}/${modelSize}/model`);
}

/**
 * Download model weights and tokenizer files from the remote sources.
 * @param {string} modelName
 * @param {string} modelSize
 */
async function downloadModel(modelName, modelSize) {
    const modelUrls = mirrors[modelName][modelSize];
    devLog("Downloading model:", modelName, modelSize, modelUrls);

    // Reset progress bar for model
    bar.set(0);

    // 1) Download model weights
    const modelBlob = await downloadFile(modelUrls.model, (pct) => {
        updateStatus(pct, "Downloading model weights...");
    });
    await writeBlob(`${modelName}/${modelSize}/model`, modelBlob);

    // 2) Download tokenizer files
    bar.set(0);
    const tokenizerFiles = Object.keys(modelUrls.tokenizer);
    const totalCount = tokenizerFiles.length;
    let completed = 0;

    for (let fileName of tokenizerFiles) {
        devLog(`Downloading tokenizer file: ${fileName} ...`);
        const tokenizerBlob = await downloadFile(modelUrls.tokenizer[fileName], (pct) => {
            updateStatus(pct, `Downloading tokenizer: ${fileName} ...`);
        });
        await writeBlob(`${modelName}/${modelSize}/${fileName}`, tokenizerBlob);

        completed++;
        updateStatus(completed / totalCount, `Downloaded tokenizer file: ${fileName}`);
    }
    updateStatus(1, "Download completed.");
    devLog("Model download complete.");
}

/**
 * Reload the UI fields based on current settings.
 */
function reloadUI() {
    document.getElementById("settings-batch-size").value = settings.batchSize;
    const seqLenSlider = document.getElementById("settings-max-seq-len-slider");
    const seqLenLabel = document.getElementById("settings-max-seq-len-label");

    seqLenSlider.value = settings.maxSeqLen;
    seqLenLabel.textContent = settings.maxSeqLen;

    document.getElementById("settings-model-name").value = settings.modelName;
    document.getElementById("settings-model-name").dispatchEvent(new Event("change"));
    document.getElementById("settings-model-size").value = settings.modelSize;

    const hwAccEl = document.getElementById("settings-hw-acceleration");
    hwAccEl.value = settings.useHwAcceleration ? "true" : "false";
}

/**
 * Send updated settings to the background script so it can re-load or
 * re-initialize the model.
 */
async function notifySettingsUpdate() {
    try {
        await chrome.runtime.sendMessage({
            type: "updateSettings",
            data: settings,
        });
        devLog("Notified background about updated settings.");
    } catch (error) {
        // If background page isn't reachable, we can ignore or show an error
        devLog("Failed to notify background script:", error);
    }
}

/**
 * Initialize the UI event listeners and load mirrors file.
 */
async function initUI() {
    // Load model info
    await loadMirrors();

    // Initialize slider event
    const seqLenSlider = document.getElementById("settings-max-seq-len-slider");
    const seqLenLabel = document.getElementById("settings-max-seq-len-label");
    seqLenSlider.addEventListener("input", function () {
        seqLenLabel.textContent = seqLenSlider.value;
    });

    // Setup model select
    const modelSelect = document.getElementById("settings-model-name");
    for (let modelName in mirrors) {
        modelSelect.options.add(new Option(modelName, modelName));
    }
    modelSelect.addEventListener("change", function () {
        loadModelSizes(modelSelect.value);
    });
    modelSelect.selectedIndex = 0;
    modelSelect.dispatchEvent(new Event("change"));

    // Handle "Save" button
    document.getElementById("save-button").addEventListener("click", async () => {
        // Disable form inputs during saving
        document.querySelectorAll("input, button, select, textarea").forEach(el => {
            el.setAttribute("disabled", "disabled");
        });

        try {
            const newSettings = {
                batchSize: parseInt(document.getElementById("settings-batch-size").value, 10),
                maxSeqLen: parseInt(seqLenSlider.value, 10),
                modelName: modelSelect.value,
                modelSize: document.getElementById("settings-model-size").value,
                useHwAcceleration:
                    document.getElementById("settings-hw-acceleration").value === "true",
            };

            await setSettings(newSettings);
            // Re-read the new settings from storage
            settings = await getSettings();

            // Check if the model is downloaded
            const exists = await checkModelExists(settings.modelName, settings.modelSize);
            devLog("Model existence check:", exists);
            if (!exists) {
                await downloadModel(settings.modelName, settings.modelSize);
            }
            await notifySettingsUpdate();

        } catch (error) {
            devLog("Error loading/downloading the model:", error);
            alert(`Failed to load the model '${settings.modelName}'. Error: ${error}`);
        } finally {
            // Re-enable form inputs
            document.querySelectorAll("input, button, select, textarea").forEach(el => {
                el.removeAttribute("disabled");
            });
        }
    });

    // Handle "Reset" button
    document.getElementById("reset-button").addEventListener("click", async () => {
        const confirmation = confirm("Are you sure you want to reset settings?");
        if (!confirmation) return;

        await resetSettings();
        settings = await getSettings();
        reloadUI();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    settings = await getSettings();
    devLog("Current settings:", settings);

    await initUI();
    reloadUI();
});
