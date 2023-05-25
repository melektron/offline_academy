/*
ELEKTRON © 2023
Written by melektron
www.elektron.work
05.05.23, 21:33

Content script that adds download functionality to NetAcad ContentHub
*/

const ASSETS_DIR_NAME = "assets"
const ASSET_BASE_PATH = "./" + ASSETS_DIR_NAME + "/";


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

class Section {

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
     * goes through all the content chunks of the currently loaded section
     * and formats the content into nice formatted HTML text while also downloading any
     * assets required
     */
    processCurrent() {
        // first, find the module title and index this section is part of 
        // so it can be saved accordingly
        
        // we get the module title from the breadcrumb at the top of the page
        const title_provider_elements = document.querySelectorAll(".breadcrumb > li:not(.home)");
        if (title_provider_elements.length < 2)
            throw new Error("Couldn't find module and/or section title in breadcrumb");
        this.module_title = (title_provider_elements[0] as HTMLDivElement).innerText;
        this.section_title = (title_provider_elements[1] as HTMLDivElement).innerText;
        // add the section title to the output document as the heading right away
        const output_section_header = document.createElement("h1");
        output_section_header.innerText = this.section_title;
        this.output_document.appendChild(output_section_header);

        // we get the module and section index from one of the chunk index labels. We just use
        // the first one (assuming that is the one the query selector returns)
        const index_provider_element = document.querySelector(".current-li") as HTMLDivElement;
        if (index_provider_element == null)
            throw new Error("Couldn't find module and section index label");
        const indices = index_provider_element.innerText.split(".");
        this.module_index = +(indices[0]);
        this.section_index = +(indices[1]);


        // next we go through all the chunks and load the content
        const content_chunks = document.querySelector(".content-chunks")?.children;
        if (content_chunks == null) {
            throw new Error("Invalid page, didn't find content chunks");
        }

        for (const chunk of content_chunks) {
            console.log(`Found chunk: ${chunk.id} ...`);

            // search for the content container of the chunk, if it doesn't exist the chunk
            // is probably the section heading and we can just ignore it
            const container = chunk.querySelector(".container");
            if (container == null) {
                console.log("(Is section heading chunk, ignoring)");
                continue;
            }
            // otherwise this is a content chunk and we need to create a content div for it

            // try to find the index of the chunk
            const index_element = container.getElementsByClassName("current-li")[0];
            const chunk_index = index_element.textContent ?? "";

            // create a new output document element for the chunk
            let output_current_chunk = document.createElement("div")
            output_current_chunk.id = chunk.id;

            // find all content components in the chunk
            // this includes direct text assets, media assets and tablists. Some of these may
            // need to be treated specially
            const content_components = container.querySelectorAll(".text-asset,div[role=\"tablist\"],img,svg,code");
            
            // flag set to false after first test-asset is processed because the 
            // first asset is the title which needs the chunk index appended
            let is_first = true;
            // a variable to store a tablist if it is encountered, so descendence can be checked
            let tablist_div: HTMLDivElement | undefined = undefined;
            // some components are part of a tablist and therefore shouldn't be processed separately.
            // this function is used to check if we have already encountered a tablist, and that 
            // an element is not part of the tablist.
            const isPartOfTabList = (_component: Element) => {
                // no tablist found jet
                if (tablist_div === undefined)
                    return false;
                
                // part of tablist
                if (tablist_div.contains(_component)) {
                    console.log("(Is part of tablist, ignoring)");
                    return true;
                }

                return false;
            }

            for (const component of content_components) {
                console.log("Processing component: ", component);

                // check for text assets
                if (
                    component.classList.contains("text-asset") && 
                    !component.classList.contains("button-label")  // we ignore the tablist button labels right away
                ) {
                    console.log("Encountered text asset");
                    if (isPartOfTabList(component))
                        continue;
                    
                    // if the element is not part of a tablist, we can save it
                    for (const assetElement of component.children) {
                        const assetElementCopy = assetElement.cloneNode(true);
                        if (is_first) {
                            // the first text element is the header and we add the chunk index to it
                            assetElementCopy.textContent = chunk_index + " " + assetElementCopy.textContent;
                            is_first = false;
                        }
                        output_current_chunk.appendChild(assetElementCopy);
                    }
                }

                // check for images
                else if (
                    component.tagName.toLocaleLowerCase() === "img"
                ) {
                    console.log("Encountered image asset");
                    if (isPartOfTabList(component))
                        continue;

                    this.processImage(output_current_chunk, component);
                }

                // check for graphics (SVGs)
                else if (
                    component.tagName.toLocaleLowerCase() === "svg"
                ) {
                    console.log("Encountered graphic asset");
                    if (isPartOfTabList(component))
                        continue;
                    
                    this.processGraphic(output_current_chunk, component);
                }

                // check for code blocks
                else if (
                    component.tagName.toLowerCase() === "code"
                ) {
                    console.log("Encountered code block");
                    if (isPartOfTabList(component))
                        continue;
                    
                    const code_block = component.cloneNode(true) as HTMLDivElement;
                    code_block.style.whiteSpace = "pre-wrap";
                    output_current_chunk.appendChild(code_block);
                }

                // check for tablists
                else if (
                    component.getAttribute("role") === "tablist"
                ) {
                    console.log("Encountered tablist");
                    if (tablist_div !== undefined)
                        throw new Error("Encountered multiple tablists in a chunk which is not allowed.");
                        
                    tablist_div = component as HTMLDivElement;

                    // TODO: process tablist
                }
                
                // any other types of media assets like quizzes are ignored with a message
                else
                    console.log(`(Not a relevant asset type: ${component.tagName})`)
                
            
            }

            // add the new content chunk to the final output to the output
            this.output_document.appendChild(output_current_chunk);

        }


        console.log("\n\n\nSection parsing complete: ", this);
        console.log("Section document preview: ", this.output_document);
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
 * Asks the user for the documentation storage folder and saves the constructed
 * document and it's assets to disk
 * @param _doc the constructed document structure to store as an html file
 * @param _assets list of all (hopefully fetched) assets needed by the document
 */
async function saveSection(_section: Section) {
    // first, wait for all the content to finish downloading or failed
    let settled_assets = await Promise.allSettled(_section.assets.map(a => a.data));
    console.log("assets finished downloading: ", settled_assets);
    
    // ask for the directory to save files to
    // @ts-ignore for some reason showDirectoryPicker() is detected here
    const main_directory_handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        mode: "readwrite"
    });

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

}


function buttonCallback() {
    const section = new Section();
    section.processCurrent();
    saveSection(section);
}

/**
 * installs a download button on the toolbar of NetAcad
 */
function installButton() {
    const toolbar = document.getElementsByClassName("header-toolbar")[0];
    if (toolbar == null)
        return;
    
    let btn_div = document.createElement("div");
    btn_div.classList.add("tooltip");
    btn_div.setAttribute("aria-describedby", "tippy-tooltip-6");
    btn_div.setAttribute("data-original-title", "Download");
    btn_div.setAttribute("style", "display: inline;");
    toolbar.appendChild(btn_div);
    
    let btn_button = document.createElement("button");
    btn_button.classList.add("btn", "btn--large", "btn--default", "btn--icon");
    btn_button.setAttribute("icon", "recent-apps");
    btn_button.setAttribute("aria-label", "Download");
    btn_button.setAttribute("color", "default");
    btn_button.onclick = buttonCallback;
    btn_div.appendChild(btn_button);

    let btn_span = document.createElement("span");
    btn_span.classList.add("icon-download");    // Cisco was nice enough to support the download icon by default just for me
    btn_button.appendChild(btn_span);
}


function main() {
    installButton()
}
setTimeout(main, 1500);
