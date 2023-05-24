


const ASSET_BASE_PATH = "./assets/"



const article = document.getElementsByClassName("content-chunks");


function buttonCallback() {
    processContent()
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

class Asset {
    constructor(
        public name: string | undefined,
        public data: Promise<Response>
    ) {}
}

/**
 * downloads an asset from a provided url asynchronously
 * 
 * @param link link to the asset. This doesn't need to contain the base URI,
 * just the path relative the the website root is fine. (e.g. "/content/imageabc.jpg")
 * @returns an object containing the file name and a promise to the response containing the file contents
 */
function downloadAsset(link: string): Asset {
    const asset_uri = new URL(link, document.baseURI);

    return new Asset(
        asset_uri.href.split("/").pop(),
        fetch(asset_uri)
    )
}

/**
 * goes through all the content chunks of the currently loaded section
 * and formats the content into nice formatted HTML text while also downloading any
 * assets required
 */
function processContent() {

    let output_content = document.createElement("div");
    let output_assets = new Array<Asset>;


    const content_chunks_query = document.getElementsByClassName("content-chunks");
    if (content_chunks_query.length !== 1) {
        console.error("Invalid page, didn't find content chunks");
    }
    const content_chunks = content_chunks_query[0].children;


    for (const chunk of content_chunks) {
        console.log(`Found chunk: ${chunk.id} ...`);

        // search for the content container, if it doesn't exist this is the section Title and 
        // we can append it's content to the output
        const container = chunk.getElementsByClassName("container")[0];
        if (container == null) {
            console.log("... Is section header chunk");
            const sectionHeader = chunk.firstElementChild;
            if (sectionHeader == null) {
                const errorHeader = document.createElement("h1");
                errorHeader.innerText = "<Missing section header>";
                output_content.appendChild(errorHeader);
            }
            else
                output_content.appendChild(sectionHeader.cloneNode(true));

            continue;
        }
        // otherwise this is a content chunk and we need to create a content div for it

        // try to find the index of the chunk
        const indexElement = container.getElementsByClassName("current-li")[0];
        const chunkIndex = indexElement.textContent ?? "";

        // create a new element for the chunk
        let output_current_chunk = document.createElement("div")
        output_current_chunk.id = chunk.id;

        // find all content components in the content block
        // this includes direct text assets, media assets and tablists. some of these may
        // need to be handeled separately
        const content_components = container.querySelectorAll(".text-asset,div[role=\"tablist\"],.media-container");
        let is_first = true;
        let tablist_div: HTMLDivElement | undefined = undefined; // a variable to store a tablist if it is encountered, so descendence can be checked
        for (const component of content_components) {
            console.log("Processing component: ", component);

            // check for text assets
            if (
                component.classList.contains("text-asset") && 
                !component.classList.contains("button-label")  // we ignore the tablist button labels right away
            ) {
                console.log("Encountered text asset");
                // if we have already encountered a tablist, check that the element is not part of the tablist.
                // only process elements that are not directly part of a tablist
                if (tablist_div !== undefined) {
                    if (tablist_div.contains(component)) {
                        console.log("(Is part of tablist, ignoring)");
                        continue;
                    }
                }
                
                // if the element is not part of a tablist, we can save it
                console.log(component.innerHTML);
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

            // check for tablists
            else if (
                component.getAttribute("role") === "tablist"
            ) {
                console.log("Encountered tablist");
                if (tablist_div !== undefined)
                    throw new Error("Encountered multiple tablists in a chunk which is not allowed.");
                    
                tablist_div = component as HTMLDivElement;
            }

            // check for media containers
            else if (
                component.classList.contains("media-container")
            ) {
                console.log("Encountered media asset");
                // if we have already encountered a tablist, check that the element is not part of the tablist.
                // only process elements that are not directly part of a tablist
                if (tablist_div !== undefined) {
                    if (tablist_div.contains(component)) {
                        console.log("(Is part of tablist, ignoring)");
                        continue;
                    }
                }

                // ignore video, but put a note in the output that there would have been a video
                if (component.classList.contains("media-video")) {
                    const video_placeholder = document.createElement("p");
                    video_placeholder.innerText = "(The video is only available in the online view, go there if you really need to look a the video.)";
                    video_placeholder.style.fontWeight = "bold";
                    output_current_chunk.appendChild(video_placeholder);
                    continue;
                }

                // for image assets, look for an img tag and download the image from the source
                else if (component.classList.contains("media-image")) {
                    const image = component.querySelector("img[src]");
                    if (image === null) {
                        console.warn("Could not find image in media image asset, skipping.");
                        continue;
                    }
                    const image_uri = image.getAttribute("src");
                    if (image_uri === null || image_uri === "") {
                        console.warn("Could not find image asset URI in media image asset, skipping.")
                        continue;
                    }
                    const asset = downloadAsset(image_uri);
                    if (asset.name === undefined) {
                        console.warn("Media image asset URI invalid, skipping.")
                        continue;
                    }
                    
                    const output_element = document.createElement("img");
                    output_element.src = ASSET_BASE_PATH + asset.name;
                    output_current_chunk.appendChild(output_element);
                }

                // for graphic assets (svg), look for an svg tag and download the source
                else if (component.classList.contains("media-graphic")) {
                    const image = component.querySelector("svg[data-src]");
                    if (image === null) {
                        console.warn("Could not find graphic in media graphic asset, skipping.");
                        continue;
                    }
                    const grahpic_uri = image.getAttribute("data-src");
                    if (grahpic_uri === null || grahpic_uri === "") {
                        console.warn("Could not find graphic asset URI in media graphic asset, skipping.")
                        continue;
                    }
                    const asset = downloadAsset(grahpic_uri);
                    if (asset.name === undefined) {
                        console.warn("Media graphic asset URI invalid, skipping.")
                        continue;
                    }
                    
                    const output_element = document.createElement("img");
                    output_element.src = ASSET_BASE_PATH + asset.name;
                    output_current_chunk.appendChild(output_element);
                }

            }
            
            // any other types of media assets like quizzes are ignored with a message
            else
                console.log("(Not a relevant asset type)")
            
           
        }

        // add the new content chunk to the final output to the output
        output_content.appendChild(output_current_chunk);

    }

    console.log("\n\n\nText output done:", output_content);

}

function main() {
    installButton()
}
setTimeout(main, 1500);

// @ts-ignore
window.processContent = processContent;