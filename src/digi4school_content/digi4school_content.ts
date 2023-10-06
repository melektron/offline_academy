/*
ELEKTRON © 2023
Written by melektron
www.elektron.work
05.05.23, 21:33

Content script that adds download functionality to digi4school books.
*/


// import PDFDocument from "pdfkit"
// import SVGtoPDF from "svg-to-pdfkit"
// import blobStream from "blob-stream"
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
            const svg_element_original = object.contentDocument?.querySelector("svg");
            if (svg_element_original == null)
                return;

            const svg_element = svg_element_original.cloneNode(true) as SVGSVGElement;

            this.processImages(svg_element);

            // TODO: convert to PDF https://pdfkit.org/docs/getting_started.html

            const blob = new Blob([svg_element.outerHTML], {
                type: "image/svg+xml"
            });

            const filename = "book_" + object.parentElement?.id + ".svg";

            // download using element in order to define name
            const download_link = document.createElement("a");
            download_link.href = URL.createObjectURL(blob);
            download_link.download = filename;

            document.body.appendChild(download_link);
            download_link.click();
            document.body.removeChild(download_link);
        });
    }

    /**
     * Processes all images in an SVG document to replace external links with embeds
     * https://stackoverflow.com/questions/934012/get-image-data-url-in-javascript
     * @param target_svg target SVG element to modify
     */
    processImages(target_svg: SVGSVGElement) {
        const images = target_svg.querySelectorAll("image");
        images.forEach((element, key, parent) => {
            console.log(element);
        });
    }

    processImage(target_image: SVGImageElement) {
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
    //main_directory_handle = await window.showDirectoryPicker({
    //    mode: "readwrite"
    //});

    const page = new BookPage();
    await page.processCurrent();
    //await savePage(page);

    //window.alert(`Download of page complete.`);
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
