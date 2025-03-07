/**
 * popup.js
 *
 * The main script for the extension's popup. It coordinates:
 * 1) Identifying the website’s privacy policy (extractPrivacyPolicyURL).
 * 2) Fetching and segmenting that policy.
 * 3) Classifying paragraphs in batches, updating a Chart.js doughnut chart.
 * 4) Displaying results and paragraphs per category.
 */

import {ArcElement, Chart, DoughnutController, Legend, Tooltip} from "chart.js";
import ProgressBar from "progressbar.js";
import {devLog} from "./utils.js";
import {segment} from "./segmentation.js";
import {getSettings} from "./settings.js";

// Constants and categories
const CLASSES = [
    "First Party Collection/Use",
    "Third Party Sharing/Collection",
    "International and Specific Audiences",
    "User Access, Edit and Deletion",
    "User Choice/Control",
    "Data Retention",
    "Policy Change",
    "Data Security",
    "Do Not Track",
    "Other",
];
const CLASSIFICATION_THRESHOLD = 0.5;
const SKIP_OTHER_CLASS = true; // If true, skip "Other" from final display

// Create arrays to store paragraphs classified under each category
const categoryParagraphs = CLASSES.map(() => []);

// Initialize Chart.js
Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

const PALETTE = [
    "#005f73",
    "#0a9396",
    "#94d2bd",
    "#e9d8a6",
    "#ee9b00",
    "#ca6702",
    "#bb3e03",
    "#ae2012",
    "#9b2226",
    "#001219",
];

const data = {
    labels: CLASSES,
    datasets: [
        {
            data: new Array(SKIP_OTHER_CLASS ? 9 : 10).fill(0),
            backgroundColor: PALETTE,
            hoverOffset: 4,
        },
    ],
};

const CHART_CONFIG = {
    type: "doughnut",
    data: data,
    options: {
        cutout: "85%",
        spacing: 5,
        borderWidth: 0,
        borderRadius: 25,
        responsive: true,
        maintainAspectRatio: false,
        // devicePixelRatio: pixelRatio, // Key for sharp rendering
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: false,
            },
        },
        hoverOffset: 0,
        interaction: {
            mode: "nearest",
            intersect: true,
        },
        elements: {
            arc: {
                hoverBorderWidth: 2,
                hoverBorderColor: "black",
            },
        },
        layout: {
            padding: 5,
        },
    },
};

let chart, bar, settings;

/**
 * Show an error message in the analysis container.
 * @param {string} message
 */
function displayError(message) {
    const container = document.getElementById("analysis-container");
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.innerHTML = "";

    const img = document.createElement("img");
    img.id = "error-icon";
    img.src = "assets/warning.svg";

    const paragraph = document.createElement("p");
    paragraph.id = "error-message";
    paragraph.innerHTML = message;

    container.appendChild(img);
    container.appendChild(paragraph);
}

/**
 * Progress bar update animation.
 * @param {number} value
 * @param {number} [duration=10]
 */
function updateProgressBar(value, duration = 10) {
    bar.animate(value, {duration: duration});
}

/**
 * Create the clickable legend item for each category,
 * including expansion logic to show paragraphs within that category.
 */
function getCategoryItem(category, color, value) {
    let categoryItem = document.createElement("li");
    let header = document.createElement("div");
    let catColor = document.createElement("div");
    let catText = document.createElement("div");
    let catValue = document.createElement("div");

    catColor.style.backgroundColor = color;
    catColor.classList.add("category-color");
    catText.textContent = category;
    catText.classList.add("category-text");
    catValue.textContent = value;
    catValue.classList.add("category-value");

    header.appendChild(catColor);
    header.appendChild(catText);
    header.appendChild(catValue);
    categoryItem.appendChild(header);

    categoryItem.classList.add("category-item");
    header.classList.add("category-item-header");

    header.addEventListener("click", () => {
        const index = CLASSES.indexOf(category);
        const paragraphs = categoryParagraphs[index];
        let existingList = categoryItem.querySelector(".paragraph-list");
        if (!existingList) {
            existingList = document.createElement("ul");
            existingList.classList.add("paragraph-list");
            existingList.style.display = "none";
            categoryItem.appendChild(existingList);
        }
        existingList.innerHTML = "";

        // Sort paragraphs by probability (descending)
        paragraphs.sort((a, b) => b.probability - a.probability);

        paragraphs.forEach((p) => {
            const listItem = document.createElement("li");
            listItem.textContent = p.text;
            listItem.title = `Probability: ${p.probability.toFixed(2)}`;
            listItem.addEventListener("click", () => {
                listItem.classList.toggle("expanded");
            });
            existingList.appendChild(listItem);
        });

        existingList.style.display =
            existingList.style.display === "none" ? "block" : "none";
    });

    // Chart highlighting
    categoryItem.addEventListener("mouseover", () => {
        const index = CLASSES.indexOf(category);
        chart.setActiveElements([{datasetIndex: 0, index}]);
        chart.update();
    });
    categoryItem.addEventListener("mouseout", () => {
        chart.setActiveElements([]);
        chart.update();
    });

    return categoryItem;
}

/**
 * Rebuild the category list (legend) in the popup.
 * Only display categories which have a non-zero count.
 */
function updateCategoryList() {
    const listContainer = document.getElementById("category-list-container");
    listContainer.innerHTML = "";

    const dataArray = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const colors = chart.data.datasets[0].backgroundColor;

    for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        if (val > 0) {
            const item = getCategoryItem(labels[i], colors[i], val);
            listContainer.appendChild(item);
        }
    }
}

/**
 * Get all links from the active tab’s DOM (via chrome.scripting).
 * @returns {Promise<{ href: string; textContent: string; }[]>}
 */
function getAllLinksFromActiveTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            if (!tabs.length) {
                return reject(new Error("No active tab found."));
            }
            const activeTab = tabs[0];

            function extractLinks() {
                const anchors = document.querySelectorAll("a");
                return Array.from(anchors).map((anchor) => ({
                    href: anchor.href,
                    textContent: anchor.textContent.trim(),
                }));
            }

            chrome.scripting.executeScript(
                {
                    target: {tabId: activeTab.id},
                    func: extractLinks,
                },
                function (injectionResults) {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    if (injectionResults && injectionResults[0]) {
                        resolve(injectionResults[0].result);
                    } else {
                        resolve([]);
                    }
                }
            );
        });
    });
}

/**
 * Attempt to locate a link that leads to a privacy policy in the active tab’s DOM.
 * @returns {Promise<string>} - The best guess privacy policy URL.
 */
async function extractPrivacyPolicyURL() {
    const links = await getAllLinksFromActiveTab();
    if (!links || links.length === 0) {
        throw new Error("No links found in the active tab.");
    }

    // Try to match typical privacy policy patterns
    const candidatePatterns = [
        /privacy\s*(policy|notice|statement|terms|agreement)?/i,
        /data\s*protection/i,
        /gdpr/i,
    ];

    let candidates = links.filter((link) => {
        const tMatch = candidatePatterns.some((pat) => pat.test(link.textContent));
        const hMatch = candidatePatterns.some((pat) => pat.test(link.href));
        return tMatch || hMatch;
    });

    // Fallback: look for "/privacy" in the path
    if (candidates.length === 0) {
        candidates = links.filter((link) => /\/privacy(-policy)?/i.test(link.href));
    }

    if (candidates.length === 0) {
        throw new Error("No privacy policy URL found in page links.");
    }

    // Basic ranking
    candidates = candidates.map((c) => {
        let score = 0;
        if (/privacy/i.test(c.textContent)) score += 2;
        if (/privacy-policy/i.test(c.href)) score += 2;
        return {...c, score};
    });
    candidates.sort((a, b) => b.score - a.score);

    return candidates[0].href;
}

/**
 * Send texts to background for classification. Retries on Chrome runtime error.
 */
async function classifyText(inputs) {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const maxAttempts = 3;
    const retryDelay = 1500;

    const attemptInference = async () => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                {
                    type: "runInference",
                    data: inputs,
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        return reject({
                            type: "runtimeError",
                            message: chrome.runtime.lastError.message,
                        });
                    }
                    if (response.type === "result") {
                        resolve(response.data);
                    } else if (response.type === "error") {
                        reject({type: "serviceError", message: response.data});
                    } else {
                        reject({type: "unknownError", message: "Unexpected response type"});
                    }
                }
            );
        });
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await attemptInference();
        } catch (error) {
            if (error.type === "runtimeError") {
                devLog(`Attempt ${attempt} failed due to runtime error:`, error.message);
                if (attempt < maxAttempts) {
                    devLog(`Retrying after ${retryDelay / 1000}s...`);
                    await sleep(retryDelay);
                } else {
                    throw new Error("Max retry attempts reached.");
                }
            } else {
                throw new Error(error.message);
            }
        }
    }
}

// --------------------------------------------
// DOMContentLoaded main flow

document.addEventListener("DOMContentLoaded", async function () {
    // Create progress bar
    bar = new ProgressBar.Line("#progress-bar-container", {
        strokeWidth: 4,
        easing: "easeInOut",
        color: "#3A8DFF",
    });

    const chartContext = document.getElementById("chart-container").getContext("2d");
    chart = new Chart(chartContext, CHART_CONFIG);

    // Listen for logs from background (optional)
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "log") {
            devLog("[Service Worker]", message.data);
        }
    });

    try {
        settings = await getSettings();
        devLog("Popup loaded with settings:", settings);

        // Display domain
        const policyDomainElement = document.getElementById("policy-domain");
        const tabs = await new Promise((resolve) =>
            chrome.tabs.query({active: true, currentWindow: true}, (ts) => resolve(ts))
        );
        let hostname = new URL(tabs[0].url).hostname;
        if (hostname.startsWith("www.")) {
            hostname = hostname.slice(4);
        }
        policyDomainElement.textContent = hostname;

        // Attempt to locate the privacy policy link
        const startURLTime = performance.now();
        const privacyPolicyURL = await extractPrivacyPolicyURL();
        devLog("Policy URL extraction took", performance.now() - startURLTime, "ms");

        policyDomainElement.href = privacyPolicyURL;
        policyDomainElement.target = "_blank";

        // Fetch the policy text
        const policyRequest = await fetch(privacyPolicyURL, {redirect: "follow"});
        const policyText = await policyRequest.text();
        const policyDoc = new DOMParser().parseFromString(policyText, "text/html");

        // Segment the policy
        const startSegTime = performance.now();
        const paragraphs = segment(policyDoc);
        devLog("Segmentation took", performance.now() - startSegTime, "ms");
        devLog("Segments found:", paragraphs.length);

        if (paragraphs.length === 0) {
            displayError("No text found in the privacy policy.");
            bar.set(0);
            return;
        }

        // Start classification in batches
        const chartTotal = document.getElementById("chart-total");
        chartTotal.textContent = "0";
        chartTotal.style.visibility = "visible";

        const t0 = performance.now();
        for (let i = 0; i < paragraphs.length; i += settings.batchSize) {
            const batch = paragraphs.slice(i, i + settings.batchSize);

            const batchStartTime = performance.now();
            const result = await classifyText(batch);
            devLog("Classification result dims:", result.dims);

            for (let b = 0; b < result.dims[0]; b++) {
                for (let c = 0; c < result.dims[1]; c++) {
                    // Skip "Other" class if SKIP_OTHER_CLASS
                    if (SKIP_OTHER_CLASS && c === CLASSES.indexOf("Other")) continue;

                    const probability = result.cpuData[b * CLASSES.length + c];
                    const categoryBit = probability >= CLASSIFICATION_THRESHOLD ? 1 : 0;
                    chart.data.datasets[0].data[c] += categoryBit;

                    if (categoryBit === 1) {
                        categoryParagraphs[c].push({
                            text: batch[b],
                            probability,
                        });
                        // update total
                        chartTotal.textContent = String(parseInt(chartTotal.textContent) + 1);
                    }
                }
            }

            const progressPct = (i + settings.batchSize) / paragraphs.length;
            const batchEndTime = performance.now();

            chart.update();
            updateCategoryList();
            updateProgressBar(progressPct, (batchEndTime - batchStartTime) * 0.95);
        }

        const t1 = performance.now();
        devLog(`Full classification took ${t1 - t0} ms.`);
        bar.set(1);

    } catch (error) {
        devLog(error);
        displayError(error.message);
    } finally {
        // Reset or finalize the progress bar if needed
        setTimeout(() => bar.set(0), 1500);
    }
});
