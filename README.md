# Offline Academy

Browser extension which adds save/download buttons to some locked-ecosystem websites and eBook readers to allow saving their content offline as regular files.

Currently supported browsers:

- Chromium-based browsers

(Support for others should be trivial to implement, feel free to add it in a PR)

Currently supported websites:

- Cisco Network Academy (NetAcad)
- Digi4School eBook reader for Austrian school books


## Downloading from Cisco NetAcad

The extension adds a download button to the toolbar on every Cisco NetAcad course. The button will open a folder picker, as it needs to save multiple files. 

After selecting the folder, it save the currently open course section as a simple HTML document which could even be represented using markdown. Any assets such as images and graphics encountered are also automatically saved in the neighboring assets folder.

Embedded codeblocks (which are simply html "code" tags) are preserved as is.

NetAcad has the annoyance of interactive elements such as tabs in their corses to e.g. compare different network protocols and show specifics for each. Offline Academy automatically clicks through any tablists and other simple interactive elements, saving the text and assets from each tab in a static format represented in the HTML document using subheadings.

Complex interactive elements such as exams and interactive code blocks, as well as attached PacketTracer documents are not saved (although PacketTracer document download may be added, feel free to submit a PR ;) ).


## Downloading from Digi4School

The extension adds a download button to the toolbar on every digi4school ebook. This button will download the current page as an SVG file (or two pages when in dual-page mode). All content is embedded in the file -> no internet connection required to read it after the download.

It may be useful to get the page as a PDF. Currently, this is not done automatically by the extension at this point (I couldn't get it to work), though I would like to add that feature in the future (Feel free to submit PR if you have any ideas).

For now, you can use ```rsvg-convert``` to convert the SVG to a PDF:

```bash
# According to https://superuser.com/questions/381125/how-do-i-convert-an-svg-to-a-pdf-on-linux
rsvg-convert -f pdf -o book_pg50.pdf book_pg50.svg
```

The tool is included with ```librsvg2``` which you should be able to get with most package managers:

```bash
sudo apt install librsvg2-bin
sudo pacman -S librsvg
# ... More: https://command-not-found.com/rsvg-convert
```

(If you are using Windows simply switch to Linux).


## Installing the extension

This extension is not distributed on any stores. You need to build and install it yourself. The repository provides a webpack configuration which does all building automagically, so you just need to clone the repo, install dependencies and run the build target using npm:

```bash
git clone https://github.com/melektron/offline_academy.git
cd offline_academy
npm i
npm run build
```

All build artifacts are placed in the ```dist``` folder. 

(Currently, as only chromium-based browsers are supported, this folder is the unpacked chrome extension, although subfolders may be added for more browsers in the future.)

### Install in chromium-based browsers

You can load the unpacked extensions by selecting the ```dist``` folder according to [Google's developer documentation](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked).


## Contributions

I am open to contributions of any kind, so if you have any feature ideas, bugfixes or typo fixes feel free to submit an Issue or - even better - a Pull Request.

## Development notes and links

Initial guidance on setting up typescript:
https://betterprogramming.pub/creating-chrome-extensions-with-typescript-914873467b65

Possible SolidJS support for later:
https://github.com/fuyutarow/solid-chrome-extension-template/tree/alpha

TypeScript template:
https://github.com/bendersej/chrome-extension-typescript/tree/master

Possible hot extension reloader for later:
https://github.com/SimplifyJobs/webpack-ext-reloader/

Possibly add this to tsconfig:


```json

,
        "lib": [
            "ES6",
            "DOM",
            "DOM.Iterable",
            "ES2021.String",
        ]
```