

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


function processContent() {

    let contentOutput = document.createElement("div");

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
                contentOutput.appendChild(errorHeader);
            }
            else
                contentOutput.appendChild(sectionHeader.cloneNode(true));

            continue;
        }
        // otherwise this is a content chunk and we need to create a content div for it

        // try to find the index of the chunk
        const indexElement = container.getElementsByClassName("current-li")[0];
        const chunkIndex = indexElement.textContent ?? "";

        // create a new element for the chunk
        let contentChunk = document.createElement("div")
        contentChunk.id = chunk.id;

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
                    contentChunk.appendChild(assetElementCopy);
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
            // also make sure they are not in a tablsit
            // TODO:
            
           
        }

        // add the new content chunk to the final output to the output
        contentOutput.appendChild(contentChunk);

    }

    console.log("\n\n\nText output done:", contentOutput);

}

function main() {
    installButton()
}
setTimeout(main, 1500);

// @ts-ignore
window.processContent = processContent;