const path = require("path");
const fs = require("fs");
const { merge } = require("webpack-merge");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

// Supported browsers
const supportedBrowsers = ["chromium", "firefox"];

/**
 * Loads and merges the common manifest with the browser-specific manifest.
 */
function getManifest(browser) {
    const commonManifest = require("./src/manifest.common.json");

    const browserManifestPath = `./src/manifest.${browser}.json`;
    if (!fs.existsSync(browserManifestPath)) {
        throw new Error(`Manifest file not found for browser: ${browser}`);
    }

    const browserManifest = require(browserManifestPath);
    return { ...commonManifest, ...browserManifest };
}

/**
 * Writes the merged manifest to dist/<browser>/manifest.json
 */
function writeManifest(browser) {
    const manifest = getManifest(browser);
    const outputPath = path.resolve(__dirname, `dist/${browser}/manifest.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf8");
}

/**
 * Generates a Webpack configuration for a specific browser.
 */
function generateConfig(browser) {
    writeManifest(browser);

    const outputPath = path.resolve(__dirname, `dist/${browser}/`);

    const commonConfig = {
        mode: "production",
        devtool: "cheap-module-source-map",
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env"]
                        }
                    }
                }
            ]
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    { from: "src/styles", to: `${outputPath}/styles` },
                    { from: "src/models.json", to: `${outputPath}/models.json` },
                    { from: "src/assets", to: `${outputPath}/assets` }
                ]
            }),
            new webpack.DefinePlugin({
                BROWSER: JSON.stringify(browser)
            })
        ],
        resolve: {
            fallback: {
                fs: false,
                path: require.resolve("path-browserify")
            }
        },
        output: {
            path: outputPath,
            filename: "scripts/[name].js"
        }
    };

    const backgroundConfig = merge(commonConfig, {
        entry: {
            background: "./src/scripts/background.js"
        },
        target: "webworker"
    });

    const popupConfig = merge(commonConfig, {
        entry: {
            popup: "./src/scripts/popup.js"
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    { from: "src/popup.html", to: `${outputPath}/popup.html` }
                ]
            })
        ],
        target: "web"
    });

    const settingsUiConfig = merge(commonConfig, {
        entry: {
            settings_ui: "./src/scripts/settings_ui.js"
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: "src/settings.html",
                filename: "settings.html",
                templateParameters: {
                    version: getManifest(browser).version,
                    browser: browser
                }
            })
        ],
        target: "web"
    });

    return [backgroundConfig, popupConfig, settingsUiConfig];
}

/**
 * Main export function.
 * - If env.browser is set, build only for that browser.
 * - If env.browser is not set, build for all supported browsers.
 */
module.exports = (env) => {
    const browsers = env && env.browser ? [env.browser] : supportedBrowsers;

    return browsers.flatMap(generateConfig);
};
