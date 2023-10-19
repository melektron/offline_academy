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


class BookPage {
    /**
     * gets the current page's SVG document and processes it
     */
    async processCurrent() {
        let objects = document.querySelectorAll("#contentContainer object");
        for (const object of objects) {
            if (!(object instanceof HTMLObjectElement))
                return;
            const svg_element_original = object.contentDocument?.querySelector("svg");
            if (svg_element_original == null)
                return;

            const svg_element = svg_element_original.cloneNode(true) as SVGSVGElement;

            await this.processImages(svg_element);

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
        };
    }

    /**
     * Processes all images in an SVG document to replace external links with embeds
     * @param target_svg target SVG element to modify
     */
    async processImages(target_svg: SVGSVGElement) {
        const images = target_svg.querySelectorAll("image");
        for (const element of images) {
            // process all images
            await this.processImage(element);
        }
    }

    /**
     * Replaces an SVG image's externally linked source with an equivalent data URL
     * @param target_image SVG image element to modify
     * @returns 
     */
    async processImage(target_image: SVGImageElement) {
        // https://stackoverflow.com/a/20285053
        // convert image to a data url so image data can be embedded
        return new Promise<void>((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.onload = function() {
                let reader = new FileReader();
                reader.onloadend = function() {
                    // change the image to use the generated data url
                    target_image.setAttribute("xlink:href", reader.result as string);
                    // async return
                    resolve()
                }
                reader.readAsDataURL(xhr.response);
            };
            xhr.open('GET', target_image.href.baseVal);
            xhr.responseType = 'blob';
            xhr.send();
        });
    }

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
