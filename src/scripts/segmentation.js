/**
 * segmentation.js
 *
 * Extract paragraphs from a privacy policy document. Removes unwanted elements
 * and splits the text into meaningful segments.
 */

import {devLog} from "./utils.js";

/**
 * Removes common unwanted elements from the DOM (e.g., ads, navbars, scripts, etc.).
 * @param {Document} document
 * @returns {Document}
 */
function removeUnwantedElements(document) {
    const selectors = [
        "header", "footer", "nav", "aside",
        ".ad", ".sidebar", ".footer",
        "#header", "#footer", "#ads", ".ads",
        ".cookie-banner", ".popup", "script", "style",
    ];

    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => element.remove());
    });

    return document;
}

/**
 * Heuristic check to see if a paragraph has at least minimal meaningful content.
 * @param {string} text
 * @returns {boolean}
 */
function hasMeaningfulContent(text) {
    // Example heuristic: check for presence of multiple words
    return /[a-z0-9]+\s+[a-z0-9]+/i.test(text);
}

/**
 * Segment the policy document into text paragraphs.
 * @param {Document} document
 * @returns {string[]} - Array of segmented paragraphs.
 */
export function segment(document) {
    removeUnwantedElements(document);

    const paragraphs = [];
    // Potential text-rich elements
    const textSelectors = [
        "p",
        "div.text-content",
        "article",
        "section",
        "div[class*='content']",
        "div[class*='text']",
        "[data-content]",
        "li",
        "span:not([class])",
        "td",
    ];

    textSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            const text = element.textContent.trim();
            // Keep if it's quite long or inside p/li
            if (text.length > 100 || element.closest("p, li")) {
                paragraphs.push(text);
            }
        });
    });

    // Filter duplicates and short/uninteresting text
    const uniqueAndRelevant = paragraphs.filter((txt, idx, self) =>
        self.indexOf(txt) === idx &&
        txt.length > 50 &&
        hasMeaningfulContent(txt)
    );

    devLog("Segmented paragraphs:", uniqueAndRelevant.length);
    return uniqueAndRelevant;
}
