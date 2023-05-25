


const ASSETS_DIR_NAME = "assets"
const ASSET_BASE_PATH = "./" + ASSETS_DIR_NAME + "/";


const article = document.getElementsByClassName("content-chunks");


function buttonCallback() {
    const section = processCurrentSection();
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
    constructor(
        public document: HTMLDivElement,
        public assets: LoadingAsset[],
        public module_index: number,
        public module_title: string,
        public section_index: number,
        public section_title: string
    ) {}
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
 * goes through all the content chunks of the currently loaded section
 * and formats the content into nice formatted HTML text while also downloading any
 * assets required
 */
function processCurrentSection(): Section {

    let output_document = document.createElement("div");
    let output_assets = new Array<LoadingAsset>;
    let output_module_index: number = 0;
    let output_module_title: string = "";
    let output_section_index: number = 0;
    let output_section_title: string = "";

    // first, find the module title and index this section is part of 
    // so it can be saved accordingly
    
    // we get the module title from the breadcrumb at the top of the page
    const title_proider_elements = document.querySelectorAll(".breadcrumb > li:not(.home)");
    if (title_proider_elements.length < 2)
        throw new Error("Couldn't find module and/or section title in breadcrumb");
    output_module_title = (title_proider_elements[0] as HTMLDivElement).innerText;
    output_section_title = (title_proider_elements[1] as HTMLDivElement).innerText;
    // (section title could also be loaded here but we load it later for the document anyway)

    // we get the module and section index from one of the chunk index labels. We just use
    // the first one (assuming that is the one the query selector returns)
    const index_providor_element = document.querySelector(".current-li") as HTMLDivElement;
    if (index_providor_element == null)
        throw new Error("Couldn't find module and section index label");
    const indices = index_providor_element.innerText.split(".");
    output_module_index = +(indices[0]);
    output_section_index = +(indices[1]);


    // next we go through all the chunks and load the content
    const content_chunks_query = document.getElementsByClassName("content-chunks");
    if (content_chunks_query.length !== 1) {
        console.error("Invalid page, didn't find content chunks");
    }
    const content_chunks = content_chunks_query[0].children;

    for (const chunk of content_chunks) {
        console.log(`Found chunk: ${chunk.id} ...`);

        // search for the content container, if it doesn't exist this is the section Title and 
        // we can append it's content to the output document
        const container = chunk.getElementsByClassName("container")[0];
        if (container == null) {
            console.log("... Is section header chunk");
            const sectionHeader = chunk.firstElementChild as HTMLHeadingElement;
            if (sectionHeader == null) {
                const errorHeader = document.createElement("h1");
                errorHeader.innerText = "<Missing section header>";
                output_document.appendChild(errorHeader);
            } else {
                output_document.appendChild(sectionHeader.cloneNode(true));
            }

            continue;
        }
        // otherwise this is a content chunk and we need to create a content div for it

        // try to find the index of the chunk
        const indexElement = container.getElementsByClassName("current-li")[0];
        const chunkIndex = indexElement.textContent ?? "";

        // create a new output document element for the chunk
        let output_current_chunk = document.createElement("div")
        output_current_chunk.id = chunk.id;

        // find all content components in the chunk
        // this includes direct text assets, media assets and tablists. Some of these may
        // need to be treated specially
        const content_components = container.querySelectorAll(".text-asset,div[role=\"tablist\"],img,svg");
        
        let is_first = true;
        let tablist_div: HTMLDivElement | undefined = undefined; // a variable to store a tablist if it is encountered, so descendence can be checked
        const isPartOfTabList = (_component: Element) => {
            // some components are part of a tablist and therefore shouldn't be processed separately.
            // this function is used to check if we have already encountered a tablist, and that 
            // an element is not part of the tablist.
            
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
                        assetElementCopy.textContent = chunkIndex + " " + assetElementCopy.textContent;
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
                    continue

                const image_uri = component.getAttribute("src");
                if (image_uri === null || image_uri === "") {
                    console.warn("Could not find image URI in image asset, skipping.")
                    continue;
                }
                const asset = downloadAsset(image_uri);
                if (asset.name === undefined) {
                    console.warn("Media image asset URI invalid, skipping.")
                    continue;
                }
                output_assets.push(asset);

                const output_element = document.createElement("img");
                output_element.src = ASSET_BASE_PATH + asset.name;
                output_current_chunk.appendChild(output_element);
            }

            // check for graphics (SVGs)
            else if (
                component.tagName.toLocaleLowerCase() === "svg"
            ) {
                console.log("Encountered graphic asset");
                if (isPartOfTabList(component))
                    continue
                
                const grahpic_uri = component.getAttribute("data-src");
                if (grahpic_uri === null || grahpic_uri === "") {
                    console.warn("Could not find graphic URI in graphic asset, skipping.")
                    continue;
                }
                const asset = downloadAsset(grahpic_uri);
                if (asset.name === undefined) {
                    console.warn("Graphic asset URI invalid, skipping.")
                    continue;
                }
                output_assets.push(asset);
                
                const output_element = document.createElement("img");
                output_element.src = ASSET_BASE_PATH + asset.name;
                output_current_chunk.appendChild(output_element);

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
        output_document.appendChild(output_current_chunk);

    }

    const output_section = new Section(
        output_document,
        output_assets,
        output_module_index,
        output_module_title,
        output_section_index,
        output_section_title
    );

    console.log("\n\n\nSection parsing complete: ", output_section);
    console.log("Section document preview: ", output_section.document);
    return output_section;
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

    // open the module directory
    const module_directory_name = _section.module_index + "_" + _section.module_title.replace(" ", "_");
    const module_directory_handle = await main_directory_handle.getDirectoryHandle(module_directory_name, {
        create: true
    });

    // save the section file
    const section_file_name = _section.module_index + "_" + _section.section_index + "_" + _section.section_title.replace(" ", "_") + ".html";
    const section_file_handle = await module_directory_handle.getFileHandle(section_file_name, {
        create: true
    });
    // @ts-ignore for some reason  createWritable is also not found by TS
    const section_file_writable  = await section_file_handle.createWritable();
    await section_file_writable.write(
        "<html><body>" +
        _section.document.innerHTML + 
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

function main() {
    installButton()
}
setTimeout(main, 1500);

// @ts-ignore
window.processCurrentSection = processCurrentSection;