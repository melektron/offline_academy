import { React } from "./fake_react";



const article = document.getElementsByClassName("content-chunks");


function buttonCallback() {

}


function installButton() {
    const toolbar = document.getElementsByClassName("header-toolbar")[0];
    if (toolbar == null)
        return;

    toolbar.appendChild(
        <div class="tooltip" data-tooltipped="" aria-describedby="tippy-tooltip-1" data-original-title="Recently Viewed" style="display: inline;">
            <button class="btn btn--large btn--default btn--icon" icon="recent-apps" aria-label="Recently Viewed" color="default">
                <span class="icon-recent-apps"></span>
            </button>
        </div>
    )
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

        // find all text assets in the content block
        const text_assets = container.getElementsByClassName("text-asset");
        let is_first = true;
        for (const asset of text_assets) {
            console.log(asset.innerHTML);
            for (const assetElement of asset.children) {
                const assetElementCopy = assetElement.cloneNode(true);
                if (is_first) {
                    // the first text element is the header and we add the chunk index to it
                    assetElementCopy.textContent = chunkIndex + " " + assetElementCopy.textContent;
                    is_first = false;
                }
                contentChunk.appendChild(assetElementCopy);
            }
        }

        // add the new content chunk to the final output to the output
        contentOutput.appendChild(contentChunk);

    }

    console.log("\n\n\nText output done:", contentOutput);

}


setTimeout(processContent, 5000);

window.processContent = processContent;