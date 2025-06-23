/*
ELEKTRON © 2025 - now
Written by melektron
www.elektron.work
23.06.25, 18:21

plugin code for https://bedienungsanleitu.ng/ to download 
*/

// import PDFDocument from "pdfkit"
// import SVGtoPDF from "svg-to-pdfkit"
// import blobStream from "blob-stream"


function download()
{
    
}


/**
 * installs a download button on the toolbar of digi4school
 */
function installButton() {
    const maybe_old_button = document.querySelector("[dlpp_dl_btn=\"\"");
    if (maybe_old_button != null)
        maybe_old_button.remove();

    const toolbar = document.querySelector(".viewer__toolbar-top");
    if (toolbar == null)
        return;
    const btn_base = toolbar.firstElementChild;
    if (btn_base == null)
        return;
    const dl_btn = btn_base.cloneNode(true) as Element;
    dl_btn.setAttribute("dlpp_dl_btn", "");


    toolbar.appendChild(dl_btn);

    console.log("we have added a button or so2", toolbar);
}


function main() {
    console.log("installing offline academy");
    installButton();
    console.log("done installing offline academy");
}
//setTimeout(main, 1500);
main();

export {};
