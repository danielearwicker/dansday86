const transformation = require('transform-coordinates') 
const fs = require("fs");
const lzString = require("lz-string");

const cw = 4000, ch = 3000;
const zoneSize = 10;

const zones = [];

function toBounds(x, y, w, h, t) {
    const bl = t.forward({ x: x * cw, y: y * ch });
    const br = t.forward({ x: (x + w) * cw, y: y * ch });
    const tr = t.forward({ x: (x + w) * cw, y: (y + h) * ch });
    const tl = t.forward({ x: x * cw, y: (y + h) * ch });
    
    return [
        { lng: bl.x, lat: bl.y },
        { lng: br.x, lat: br.y },
        { lng: tr.x, lat: tr.y },
        { lng: tl.x, lat: tl.y },
    ]
}

const junk = {};
for (const line of fs.readFileSync("junk.txt", "utf8")
                     .split("\n")
                     .map(x => x.trim())
                     .filter(x => !!x)) {
    junk[line] = true;
}

function readFile(filePath, pattern, transform) {

    const fileText = fs.readFileSync(filePath, "utf8");

    const coordCounts = {};
    const cells = [];

    for (const record of fileText.split("\n").map(line => line.split(" "))) {    
        const [type, url] = record;
        
        if (type !== "P") {
            continue;
        }

        const match = pattern.exec(url);
        if (!match) {
            continue;
        }

        const junkKey = match[0].replace("dblock/", "");
        if (junk[junkKey]) {
            continue;
        }

        const x = parseInt(match[1], 10) / cw;
        const y = parseInt(match[2], 10) / ch;

        if (type === "P") {
            const key = `${x}-${y}`;

            if (!coordCounts[key]) {
                coordCounts[key] = 0;
            }
        
            if ((coordCounts[key]++) == 0) {
                cells.push({ x, y, url, bounds: toBounds(x, y, 1, 1, transform) });
            }
        }
    }

    const minX = Math.floor(cells.map(c => c.x).reduce((l, r) => Math.min(l, r)) / zoneSize);
    const maxX = Math.ceil(cells.map(c => c.x).reduce((l, r) => Math.max(l, r)) / zoneSize);
    const minY = Math.floor(cells.map(c => c.y).reduce((l, r) => Math.min(l, r)) / zoneSize);
    const maxY = Math.ceil(cells.map(c => c.y).reduce((l, r) => Math.max(l, r)) / zoneSize);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const [l, r, b, t] = [
                x * zoneSize, (x + 1) * zoneSize,
                y * zoneSize, (y + 1) * zoneSize
            ];

            const zoneId = zones.length;
            const zoneCells = cells.filter(c => c.x >= l && c.x < r && c.y >= b && c.y < t);
            
            if (zoneCells.length > 0) {
                const cellsJson = JSON.stringify(zoneCells);
                const cellsCompressed = lzString.compressToBase64(cellsJson);

                zones.push({
                    id: zoneId,
                    cellCount: zoneCells.length,
                    bounds: toBounds(l, b, r - l, t - b, transform),
                    cells: cellsCompressed
                });
            }
        }
    }
}

readFile("map-gb.txt", /dblock\/GB-(\d+)-(\d+)/, transformation("EPSG:27700", "EPSG:4326"));
readFile("map-ni.txt", /dblock\/NI-(\d+)-(\d+)/, transformation("EPSG:29901", "EPSG:4326"));

fs.writeFileSync("../site/zones.json", JSON.stringify(zones, null, 4));
