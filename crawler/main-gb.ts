/// <reference path="./deno.d.ts" />

const mapFileName = "map.txt";

type Type = "Q" | "P" | "A" | "E";

const map: { [url: string]: Type } = {};
const queue: string[] = [];
let offset = 0;

async function crawl() {

    const fileText = await Deno.readTextFile(mapFileName);

    for (const record of fileText.split("\n").map(line => line.split(" "))) {
        const [type, url] = record;
        map[url] = type as Type;
    }

    for (const [url, type] of Object.entries(map)) {
        if (type === "Q") {
            queue.push(url);
        }
    }

    const encoder = new TextEncoder();

    async function emit(type: Type, url: string) {
        const csvLine = encoder.encode(`${type} ${url}\n`);
        await Deno.writeFile(mapFileName, csvLine, {append: true});
    }

    while (offset < queue.length) {

        const url = queue[offset];
        
        const got = await fetch(url);
        if (got.ok) {            
            const text = await got.text();
            
            const type = text.indexOf("<h1>Empty D-block</h1>") !== -1 || text.indexOf("<h1>Invalid D-block</h1>") !== -1 ? "A" : "P";

            const linkPattern = /<a href="(https:\/\/webarchive\.nationalarchives\.gov\.uk\/\d+\/http:\/\/www\.bbc\.co\.uk\/history\/domesday\/dblock\/GB-\d+-\d+)">(\w+)<\/a>/g;

            while(true) {
                const match = linkPattern.exec(text);
                if (!match) break;

                if (["North", "South", "East", "West"].includes(match[2])) {
                    if (!map[match[1]]) {
                        queue.push(match[1]);
                        map[match[1]] = "Q";
                        await emit("Q", match[1]);
                    }
                }
            }

            map[url] = type;
            await emit(type, url);

        } else if (got.status === 404) {
            map[url] = "E";
            await emit("E", url);
        } else {
            console.error(url, got.status, got.statusText);
        }

        offset++;
    } 
}

crawl();
