/*
ELEKTRON © 2023
Written by melektron
www.elektron.work
05.05.23, 21:33

Content script that adds download functionality to NetAcad ContentHub
*/


const ASSETS_DIR_NAME = "assets"
const ASSET_BASE_PATH = "./" + ASSETS_DIR_NAME + "/";

let main_directory_handle: FileSystemDirectoryHandle | undefined = undefined;


// https://stackoverflow.com/questions/1183872/put-a-delay-in-javascript
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


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
    async processCurrent() {
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

            /**
             * In order to parse tablists, we need to click on the buttons in the tablists, which
             * in-turn causes Cisco's react codebase to modify the DOM. When iterating over assets in
             * a chunk, if we have found a tablist asset, we use the Element.contains() method to
             * check any further assets for whether they are part of the tablist. If they are part of the 
             * tablist, they need to be ignored, because they would have been processed inside the tablist processor.
             * The problem with this approach is, that clicking the buttons inside the tablist causes React to remove
             * the previously queried asset elements from the DOM (and therefor from the tablist) in order to 
             * show different ones. So when later checking if an asset is part of a tablist, none of the assets that were
             * actually part of the tablist are anymore and therefore they get wrongfully processed and added to the output 
             * document. 
             * In order to prevent this (assuming there is only one tablist per chunk), the tablist always needs 
             * to be processed after all other assets. However, in some cases there are more assets after a tablist that
             * are not part of the tablist. If they were processed before the tablist, order of elements on the output
             * document wouldn't be correct anymore.
             * So, as soon as we encounter a tablist, we save all assets collected until then in the "output_current_chunk_before_tablist" variable,
             * and assign the output_current_chunk variable a new div element, that is then filled with the remaining assets.
             * At the end, the tablist is processed and appends output to the "output_current_chunk_before_tablist" element.
             * Then all the elements from after the tablist are added to it. This way, their order is preserved.
             */
            let output_current_chunk_before_tablist: HTMLDivElement | undefined = undefined;

            // find all content components in the chunk
            // this includes direct text assets, code blocks, media assets and tablists. Some of these may
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

                // TODO: Implement downloading of packet tracer activities

                // check for tablists
                else if (
                    component.getAttribute("role") === "tablist"
                ) {
                    console.log("Encountered tablist");
                    if (tablist_div !== undefined)
                        throw new Error("Encountered multiple tablists in a chunk which is not allowed.");
                    
                    // save the tablist for later processing (see huge comment block a few lines above)
                    tablist_div = component as HTMLDivElement;

                    // save all the assets collected until now
                    output_current_chunk_before_tablist = output_current_chunk;

                    // create a new element for the assets after the tablist
                    output_current_chunk = document.createElement("div");
                }
                
                else if (
                    component.classList.contains("button-label")
                )
                    console.log("(Is tablist button, ignoring)");

                // any other types of media assets like quizzes are ignored with a message
                else
                    console.log(`(Not a relevant asset type: ${component.tagName})`)
                
            
            }

            // if we have encountered a tablist, process it now and assemble the output document 
            // in the correct order
            if (tablist_div !== undefined) {
                // process the tablist and add it's output elements to the ones before the tablist
                if (output_current_chunk_before_tablist === undefined)
                    throw new Error("Processing tablist, but assets before tablist not defined");
                await this.processTabList(output_current_chunk_before_tablist, tablist_div);

                // now add the output elements of all the assets after the tablist to the output
                for (const element of output_current_chunk.children) {
                    output_current_chunk_before_tablist.appendChild(element);
                }

                // "output_current_chunk_before_tablist" now contains the final chunk output.
                // Add the new content chunk to the final output document.
                this.output_document.appendChild(output_current_chunk_before_tablist);

            } else {
                // Current chunk is just a regular chronological chunk without any tablists
                // Add the new content chunk to the final output document.
                this.output_document.appendChild(output_current_chunk);
            }


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
 * Asks the user for the documentation storage folder and saves the constructed
 * document and it's assets to disk
 * @param _doc the constructed document structure to store as an html file
 * @param _assets list of all (hopefully fetched) assets needed by the document
 */
async function saveSection(_section: Section) {
    // first, wait for all the content to finish downloading or failed
    let settled_assets = await Promise.allSettled(_section.assets.map(a => a.data));
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

}


// this function must not be async or else we get the error "Must be handling a user gesture to show a file picker."
async function buttonCallback() {
    // ask the user for the folder right away, because of transient activtion requirements

    // ask for the directory to save files to
    // @ts-ignore for some reason showDirectoryPicker() is detected here
    main_directory_handle = await window.showDirectoryPicker({
        mode: "readwrite"
    });

    const section = new Section();
    await section.processCurrent();
    await saveSection(section);

    window.alert(`Download of section "${section.section_title}" complete.`);
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
