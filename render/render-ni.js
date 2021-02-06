const { createCanvas } = require('canvas')
const fs = require("fs");

const fileText = fs.readFileSync("map.txt", "utf8");

const pattern = /dblock\/NI-(\d+)-(\d+)/;

const coords = [];

let minX = Number.MAX_SAFE_INTEGER;
let maxX = Number.MIN_SAFE_INTEGER;
let minY = Number.MAX_SAFE_INTEGER;
let maxY = Number.MIN_SAFE_INTEGER;

for (const record of fileText.split("\n").map(line => line.split(" "))) {
    const [type, url] = record;

    const match = pattern.exec(url);
    if (match) {
        const colour = type === "Q" ? 0 :
                       type === "P" ? 1 :
                       type === "A" ? 2 :
                       type === "E" ? 3 : undefined;
        if (colour !== undefined) {
            const x = parseInt(match[1], 10) / 4000;
            const y = parseInt(match[2], 10) / 3000;
            coords.push([x, y, colour]);

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
}

const canvas = createCanvas(3 + maxX - minX, 3 + maxY - minY);
const ctx = canvas.getContext('2d');

ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

function makePixel(r, g, b) {
    const p = ctx.createImageData(1, 1);
    p.data[0] = r;
    p.data[1] = g;
    p.data[2] = b;
    p.data[3] = 255;
    return p;
}

const colours = [
    makePixel(0, 0, 255),
    makePixel(0, 255, 0),
    makePixel(255, 255, 0),
    makePixel(255, 0, 0),    
];

for (const [x, y, c] of coords) {
    ctx.putImageData(colours[c], 1 + x - minX, 1 + ((maxY - minY) - (y - minY)));
}

fs.writeFileSync("map.png", canvas.toBuffer());
