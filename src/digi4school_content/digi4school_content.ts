/*
ELEKTRON © 2023
Written by melektron
www.elektron.work
05.05.23, 21:33

Content script that adds download functionality to digi4school books.
*/


import { sleep } from "utils/sleep"

const ASSETS_DIR_NAME = "assets"
const ASSET_BASE_PATH = "./" + ASSETS_DIR_NAME + "/";

let main_directory_handle: FileSystemDirectoryHandle | undefined = undefined;

/**
 * class representing an asset name and corresponding binary blob
 */
class Asset {
    constructor(
        public name: string,
        public data: Blob
    ) {}
}

/**
 * asset that isn't necessarily done fetching and therefore contains a promise for the data 
 */
class LoadingAsset {
    constructor(
        public name: string | undefined,
        public data: Promise<Asset>
    ) {}
}

class BookPage {

    public output_document: HTMLDivElement;
    public assets: LoadingAsset[];
    public module_index: number = 0;
    public module_title: string = "";
    public section_index: number = 0;
    public section_title: string = "";

    constructor(
    ) {
        this.output_document = document.createElement("div");
        this.assets = new Array<LoadingAsset>;
    }

    /**
     * gets the current page's SVG document and processes it
     */
    async processCurrent() {
        let objects = document.querySelectorAll("#contentContainer object");
        objects.forEach((object, index, parent) => {
            if (!(object instanceof HTMLObjectElement))
                return;
            console.log(object.contentDocument?.getRootNode());
            // TODO: do something useful
        });
    }

    processImage(current_chunk: HTMLDivElement, img_element: Element) {
        const image_uri = img_element.getAttribute("src");
        if (image_uri === null || image_uri === "") {
            console.warn("Could not find image URI in image asset, skipping.")
            return;
        }
        const asset = downloadAsset(image_uri);
        if (asset.name === undefined) {
            console.warn("Media image asset URI invalid, skipping.")
            return;
        }
        this.assets.push(asset);

        const output_element = document.createElement("img");
        output_element.src = ASSET_BASE_PATH + asset.name;
        current_chunk.appendChild(output_element);
    }

    processGraphic(current_chunk: HTMLDivElement, svg_element: Element) {
        const grahpic_uri = svg_element.getAttribute("data-src");
        if (grahpic_uri === null || grahpic_uri === "") {
            console.warn("Could not find graphic URI in graphic asset, skipping.")
            return;
        }
        const asset = downloadAsset(grahpic_uri);
        if (asset.name === undefined) {
            console.warn("Graphic asset URI invalid, skipping.")
            return;
        }
        this.assets.push(asset);
        
        const output_element = document.createElement("img");
        output_element.src = ASSET_BASE_PATH + asset.name;
        current_chunk.appendChild(output_element);
    }

    async processTabList(current_chunk: HTMLDivElement, tablist_element: HTMLDivElement) {
        // find all the selection buttons in the tablist
        const tablist_selection_buttons = tablist_element.getElementsByClassName("mbar-buttons-wrapper")[0].children;

        // go through all button and therefore selections individually
        for (const selection_button_element of tablist_selection_buttons) {
            const button = selection_button_element as HTMLButtonElement;
            
            // The button text will be added to the document as a header 3
            const tab_header = document.createElement("h3");
            tab_header.innerText = button.innerText;
            current_chunk.appendChild(tab_header);

            // activate the tab
            button.click();

            // process the content of the current tab
            const tab_content_wrapper = tablist_element.getElementsByClassName("mbar-content-wrapper")[0] as HTMLDivElement;

            // if there are any media assets in the tab that are loaded asynchronously using react we might need to wait
            // a bit until they are fully loaded. Normal images don't suffer from this.
            if (tab_content_wrapper.querySelector(".loader-wrap,.Media") != null)
                await sleep(800);
            
            this.processTabContent(current_chunk, tab_content_wrapper);
        }
    }

    processTabContent(current_chunk: HTMLDivElement, content_wrapper: HTMLDivElement) {
        // find all content components in the tab.
        // this includes direct text assets, code blocks and media assets. (Tablist in tablist does not exist)
        const content_components = content_wrapper.querySelectorAll(".text-asset,img,svg,code");
        
        // go through all assets in the tab
        for (const component of content_components) {
            console.log("Processing tab component: ", component);

            // check for text assets
            if (
                component.classList.contains("text-asset")
            ) {
                console.log("Encountered text asset in tab");
                
                for (const asset_element of component.children) {
                    const asset_element_copy = asset_element.cloneNode(true);
                    current_chunk.appendChild(asset_element_copy);
                }
            }

            // check for images
            else if (
                component.tagName.toLocaleLowerCase() === "img"
            ) {
                this.processImage(current_chunk, component);
            }

            // check for graphics (SVGs)
            else if (
                component.tagName.toLocaleLowerCase() === "svg"
            ) {
                this.processGraphic(current_chunk, component);
            }

            // check for code blocks
            else if (
                component.tagName.toLowerCase() === "code"
            ) {
                const code_block = component.cloneNode(true) as HTMLDivElement;
                code_block.style.whiteSpace = "pre-wrap";
                current_chunk.appendChild(code_block);
            }
            
            // in case there is any asset that doesn't match the above criteria (shouldn't ever happen)
            else
                console.log(`(Not a relevant asset type inside tablist tab: ${component.tagName})`)
        }
    }
}

/**
 * downloads an asset from a provided url asynchronously
 * 
 * @param link link to the asset. This doesn't need to contain the base URI,
 * just the path relative the the website root is fine. (e.g. "/content/imageabc.jpg")
 * @returns an object containing the file name and a promise to the response containing the file contents
 */
function downloadAsset(link: string): LoadingAsset {
    const asset_uri = new URL(link, document.baseURI);
    const asset_name = asset_uri.href.split("/").pop();
    console.log("Fetching Asset: ", asset_uri.href);

    // don't even try to fetch the asset if we can't determine the asset name
    if (asset_name == undefined) {
        return new LoadingAsset(
            asset_name,
            Promise.reject(new Error(`Invalid asset name, couldn't fetch: ${asset_uri.href}`))
        );
    }

    return new LoadingAsset(
        asset_name,
        new Promise<Asset>((resolve, reject) => {
            fetch(asset_uri)
                .catch(async reason => reject(reason))
                .then(async value => {
                    if (value == null) {
                        reject(new Error("Asset fetch operation delivered no result"));
                        return;
                    }
                    if (!value.ok) {
                        reject(new Error(`Asset fetch failed with code: ${value.status}`));
                        return;
                    }
                    // fetch ok
                    resolve(new Asset(
                        asset_name,
                        await value.blob()
                    ));

                });
        })
    );
}


/**
 * Saves the current book page as a PDF.
 */
async function savePage(_page: BookPage) {
    /*
    // first, wait for all the content to finish downloading or failed
    let settled_assets = await Promise.allSettled(_page.assets.map(a => a.data));
    console.log("assets finished downloading: ", settled_assets);
    
    // main directory handle acquire used to be here
    if (main_directory_handle == null)
        throw new Error("Unknown save directory");

    // @ts-ignore open the module directory
    const module_directory_name = _section.module_index + "_" + _section.module_title.replaceAll(" ", "_");
    const module_directory_handle = await main_directory_handle.getDirectoryHandle(module_directory_name, {
        create: true
    });

    // @ts-ignore save the section file
    const section_file_name = _section.module_index + "_" + _section.section_index + "_" + _section.section_title.replaceAll(" ", "_") + ".html";
    const section_file_handle = await module_directory_handle.getFileHandle(section_file_name, {
        create: true
    });
    // @ts-ignore for some reason  createWritable is also not found by TS
    const section_file_writable  = await section_file_handle.createWritable();
    await section_file_writable.write(
        "<html><body>" +
        _section.output_document.innerHTML + 
        "</body></html>"
    );
    await section_file_writable.close();


    // open the asset directory 
    const asset_directory_handle = await module_directory_handle.getDirectoryHandle("assets", {
        create: true
    });
    // save all the assets asynchronously
    for (const asset of settled_assets) {
        if (asset.status === "rejected") {
            console.error("Failed to download an asset (unknown name)");
            continue;
        }
        console.log("Saving asset: ", asset.value.name);
        const file_handle = await asset_directory_handle.getFileHandle(asset.value.name, {
            create: true
        });
        // @ts-ignore for some reason createWritable is also not found by TS
        const file_writable  = await file_handle.createWritable();
        file_writable.write(asset.value.data).then(async () => {
            console.log("Done saving asset: ", asset.value.name);
            await file_writable.close();
        }).catch(async () => {
            console.error("Failed to save asset: ", asset.value.name);
        });
    }
*/
}


// this function must not be async or else we get the error "Must be handling a user gesture to show a file picker."
async function buttonCallback() {
    // ask the user for the folder right away, because of transient activtion requirements

    // ask for the directory to save files to
    // @ts-ignore for some reason showDirectoryPicker() is detected here
    main_directory_handle = await window.showDirectoryPicker({
        mode: "readwrite"
    });

    const page = new BookPage();
    await page.processCurrent();
    //await savePage(page);

    window.alert(`Download of page complete.`);
}

/**
 * installs a download button on the toolbar of digi4school
 */
function installButton() {
    const toolbar = document.getElementById("boxEdit");
    if (toolbar == null)
        return;
    
    let btn_div = document.createElement("div");
    btn_div.id = "btnDownload";
    btn_div.classList.add("viewer-menu-icon");
    btn_div.classList.add("viewer-icon-download");  // just like cisco, digi4school were nice enough to provide us with some useful icons :-)
    //btn_div.classList.add("viewer-icon-save");
    btn_div.setAttribute("title", "Download");
    //btn_div.setAttribute("style", "vertical-align: text-top");    // some icons look better when top aligned (e.g. the bookmark one is)
    // button animation to make button responsive when clicked on the same way other buttons are
    btn_div.onpointerdown = (e) => (e.target as HTMLDivElement).classList.add("viewer-main-active");
    btn_div.onpointerup = (e) => (e.target as HTMLDivElement).classList.remove("viewer-main-active");
    btn_div.onclick = buttonCallback;
    toolbar.prepend(btn_div);
}


function main() {
    console.log("installing offline academy");
    installButton();
    console.log("done installing offline academy");
}
setTimeout(main, 1500);
