[Releases]: https://github.com/sisinflab-swot/neural-privacy-policy/releases/
[Paper]: ""
[Zenodo]: https://zenodo.org/doi/10.5281/zenodo.14911062

[Chrome]: https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-chrome-icon.svg
[Firefox]: https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/firefox-browser-icon.svg
[Edge]: https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/edge-browser-icon.svg
[Safari]: https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/safari-icon.svg
[Opera]: https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/opera-icon.svg

[Wasm]: https://upload.wikimedia.org/wikipedia/commons/1/1f/WebAssembly_Logo.svg
[WebGPU]: https://www.w3.org/2023/02/webgpu-logos/webgpu-notext.svg


# Neural Privacy Policy


Neural Privacy Policy is a liBERTa-based browser extension that automatically 
classifies and analyzes website privacy policies directly within the browser using
state-of-the-art Deep Learning models. 


## About

[![Paper](https://img.shields.io/badge/DOI--blue)]()
[![Zenodo Full Classification Results](https://img.shields.io/badge/Zenodo-Full%20Classification%20Results-green)](https://zenodo.org/doi/10.5281/zenodo.14911062)
[![GitHub Release](https://img.shields.io/github/v/release/sisinflab-swot/neural-privacy-policy)](https://github.com/sisinflab-swot/neural-privacy-policy/releases)



This extension is part of the liBERTa framework, a general-purpose client-side 
infrastructure designed to support real-time Machine Learning and Deep Learning models 
directly in the browser. 

The manuscript describing the system architecture, methodology, and performance 
evaluation is available at: DOI. 

If you use this software, models, or data set, please cite the following paper:
``` BibTeX
@inproceedings{neural-privacy-policy,
  title={},
  author={},
  booktitle={},
  year={}
}
```

## Supported Browsers

|             | <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-chrome-icon.svg" width="32" height="32"/><br/>Chrome<br/> |              <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/firefox-browser-icon.svg" width="32" height="32"/><br/>Firefox              | <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/edge-browser-icon.svg" width="32" height="32"/><br/>Edge | <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/safari-icon.svg" width="32" height="32"/><br/>Safari | <img src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/opera-icon.svg" width="32" height="32"/><br/>Opera |
|-------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:---------------------------------------------------------------------------------------------------------------------------------------------------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| WebAssembly | &check;                                                                                                                                                                        |                                                                                   **&check;**                                                                                   |  **&check;**                                                                                                                                                                   |     **&check;**                                                                                                                                                            |  **&check;**                                                                                                                                                              |
| WebGPU      | &check;                                                                                                                                                                        |                                                                                   **&cross;**                                                                                   |               **&check;**                                                                                                                                                      |                   **&check;**                                                                                                                                              | **&check;**                                                                                                                                                               |


## Build


### Download prebuilt Releases

The extension is available for download from the [Releases] section of this repository.



### Build from Source

To build the extension from source, you will need:

- Node.js
- npm
- Webpack

#### Step-by-step guide

1. Clone the repository

    ```shell
    git clone <anonymous_link>
    cd neural-privacy-policy
    ```

2. Install dependencies:
    
    ```shell
    npm install
    ```

3. Build the extension:

    ```shell
    npx webpack
    ```
    
    This will generate:
    ```
    dist/
    ├── chromium/
    └── firefox/
    ```

4. Optionally, build for specific browsers:
    
    ```shell
    npx webpack --env browser=chromium
    ```
    for chromium, or
    ```shell
    npx webpack --env browser=firefox
    ```
    for firefox.
    
    The resulting files can be loaded directly into the respective browser (see **Install** below).

---


### Build for Safari

Apple requires Web extensions for Safari to be wrapped in macOS apps.

#### Steps

1. Build for Chromium first:
    
     ```shell
     npx webpack --env browser=chromium
     ```

2. Follow [Apple's guide](https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari).


---


## Install

### Chrome, Edge, Opera (Chromium-based)

For Chromium-based browsers (Chrome, Edge, Opera), you can load the unpacked extension directly from the browser's Developer Mode:

1. Navigate to `chrome://extensions/` (or `edge://extensions/`, `opera://extensions/`)

2. Enable **Developer Mode**.

3. Click on **Load unpacked**.

4. Select the `dist/chromium`.


### Firefox

For Firefox, you can load the unpacked extension directly from the browser's Developer Mode:

1. Open `about:debugging#/runtime/this-firefox`.

2. Click on **Load Temporary Add-on...**.

3. Select the `dist/firefox/manifest.json` file.

> ⚠️ Note: Temporary add-ons in Firefox are removed when the browser restarts.


### Safari (macOS)

Safari support requires a different build process due to Apple's requirement for Web Extenions to be wrapped in macOS apps.
After building the Safari Web Extension (as described in the **Build for Safari** section), follow [Apple's guide](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension) to enable development-mode support for unsigned extensions.

---


## Usage


### Initial Setup

Once installed, the first step is to **open the extension's options page**.

1. Open the extension options by:
    - In Chrome/Edge/Opera, go to `chrome://extensions/`, find **Neural Privacy Policy**, and click on **Details**, then **Extension Options**.
    - In Firefox, go to `about:addons`, locate **Neural Privacy Policy**, click the ⚙️ icon, then **Preferences**.

2. Set preferences (model name, size, batch size, etc.) and save.

3. If the model needs to be downloaded, a **progress indicator** will appear.

4. Once the download is complete, you can **close the settings page** — the extension is now fully configured and ready to use.


> ⚠️ Note: Closing the settings page while the model download is still in progress may lead to incomplete downloads or unexpected extension behavior. It is strongly recommended to wait until the download is fully completed before closing the settings page.



### Analyzing Policies

1. **Navigate** to a website.

2. **Click the extension icon** in the browser.

3. The extension will automatically retrieve and classify the privacy policy.


## Notes on WebGPU Support

**WebGPU is still an experimental feature in many browsers**. To be able to use it, you might need to explicitly **enable WebGPU** in the browser's experimental settings (also known as "flags" in some browsers). The process varies slightly depending on the browser.

If WebGPU is not available, the extension is designed to gracefully fall back to WebAssembly (Wasm).
