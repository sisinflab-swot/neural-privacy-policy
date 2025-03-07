/**
 * background.js
 *
 * A service worker or background script for the Chrome extension
 * that loads ONNX model and tokenizer, then handles inference requests.
 */

import * as ort from "onnxruntime-web/all";
import {PreTrainedTokenizer} from "@xenova/transformers";
import {getAllBlobsWithPrefix, readBlob} from "./database.js";
import {getSettings} from "./settings.js";
import {devLog} from "./utils.js";

// Global references
let onnxSession = null;
let tokenizer = null;
let settings = await getSettings();

// --------------------------------------------
// HELPER: Convert int64 -> float32 for attention masks
function castInt64ToFloat32(int64Tensor) {
    const numberArray = Array.from(int64Tensor.data, (bigInt) => Number(bigInt));
    const float32Array = new Float32Array(numberArray);
    return new ort.Tensor("float32", float32Array, int64Tensor.dims);
}

// --------------------------------------------
// MODEL LOADING LOGIC

/**
 * Load the model and tokenizer from IndexedDB (where they've been stored as blobs).
 * @throws {Error} If the model or tokenizer files are not found in the DB.
 */
async function loadModelAndTokenizer() {
    devLog("Loading model/tokenizer with settings:", settings);

    // 1) Load model
    const modelKey = `${settings.modelName}/${settings.modelSize}/model`;
    const modelBlob = await readBlob(modelKey);
    if (modelBlob === null) {
        throw new Error(
            `Model '${settings.modelName}/${settings.modelSize}' not found in DB.`
        );
    }
    const modelArrayBuffer = await modelBlob.arrayBuffer();

    // 2) Create ONNX session
    const executionProviders = ["wasm"];
    if (settings.useHwAcceleration && ort.env.webgpu) {
        executionProviders.push("webgpu");
    }
    devLog("Using executionProviders:", executionProviders);

    onnxSession = await ort.InferenceSession.create(modelArrayBuffer, {
        executionProviders,
        graphOptimizationLevel: "all",
        wasm: {
            simd: true,
            enableThreads: true,
            numThreads: settings.numThreads || 1,
        },
        logSeverityLevel: 4,
    });

    // 3) Load tokenizer files
    tokenizer = null;
    const tokenizerFiles = await getAllBlobsWithPrefix(
        `${settings.modelName}/${settings.modelSize}/`
    );
    const tokenizerArgs = {};

    for (const file in tokenizerFiles) {
        if (file === "model") continue; // skip the actual weights

        const blob = tokenizerFiles[file];
        const type = blob.type;

        switch (type) {
            case "application/json": {
                const text = await blob.text();
                tokenizerArgs[file] = JSON.parse(text);
                break;
            }
            case "text/plain": {
                tokenizerArgs[file] = await blob.text();
                break;
            }
            case "application/octet-stream": {
                tokenizerArgs[file] = await blob.arrayBuffer();
                break;
            }
            default:
                throw new Error(`Unsupported file type for tokenizer: ${type}`);
        }
    }

    // 4) Initialize tokenizer
    tokenizer = new PreTrainedTokenizer(
        tokenizerArgs["tokenizer"],
        tokenizerArgs["tokenizer_config"]
    );
    devLog("Tokenizer loaded successfully.");
}

// --------------------------------------------
// INFERENCE FLOW

/**
 * Run inference on the given input texts. Returns the final logits or probabilities from the model.
 *
 * @param {string[]} inputs - Array of text to classify
 * @returns {Promise<ort.Tensor>} - The output from the ONNX model (e.g. classification logits).
 */
async function runInference(inputs) {
    if (!onnxSession || !tokenizer) {
        await loadModelAndTokenizer();
    }

    devLog("Running inference on", inputs.length, "input(s)");
    const startTokenTime = performance.now();

    const {input_ids, attention_mask} = await tokenizer(inputs, {
        padding: true,
        add_special_tokens: true,
        truncation: true,
        max_length: settings.maxSeqLen,
    });

    devLog("Tokenization took:", performance.now() - startTokenTime, "ms");
    devLog("Tokenized sequence length:", input_ids.dims[1]);

    // Convert to required ONNX runtime Tensors
    const inputTensorIds = new ort.Tensor(
        "int64",
        new BigInt64Array(input_ids.data),
        input_ids.dims
    );
    const inputTensorMask = castInt64ToFloat32(attention_mask);

    // Inference
    const startInferenceTime = performance.now();
    const results = await onnxSession.run({
        input_ids: inputTensorIds,
        attention_mask: inputTensorMask,
    });
    devLog("Inference took", performance.now() - startInferenceTime, "ms");

    return results["output"];
}

// --------------------------------------------
// LISTEN FOR MESSAGES

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.type) {
                case "runInference": {
                    const output = await runInference(message.data);
                    sendResponse({type: "result", data: output});
                    break;
                }
                case "updateSettings": {
                    settings = message.data;
                    devLog("Background updated settings:", settings);
                    await loadModelAndTokenizer(); // reload new model
                    sendResponse({result: "Settings updated"});
                    break;
                }
                default: {
                    devLog("Unknown message type:", message.type);
                    sendResponse({type: "error", data: `Unknown message type: ${message.type}`});
                    break;
                }
            }
        } catch (error) {
            devLog("Background script error:", error);
            sendResponse({type: "error", data: error.message || "Unknown error"});
        }
    })();

    return true; // Keep the message channel open for async
});
