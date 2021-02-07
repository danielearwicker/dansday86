import { Loader } from "@googlemaps/js-api-loader"
import { decompressFromBase64 } from "lz-string"
import zonesRaw from "./zones.json";

type PolyPoints = google.maps.LatLngLiteral[];

interface Cell {
    url: string;
    bounds: PolyPoints;
}

interface Zone {
    id: number;    
    bounds: PolyPoints;
    cellCount: number;
    cells: string;
}

const zones: Zone[] = zonesRaw as [];

function toBounds(poly: PolyPoints) {
    const min = poly.reduce((l, r) => ({
        lat: Math.min(l.lat, r.lat), 
        lng: Math.min(l.lng, r.lng) 
    }));
    const max = poly.reduce((l, r) => ({
        lat: Math.max(l.lat, r.lat), 
        lng: Math.max(l.lng, r.lng) 
    }));
    return new google.maps.LatLngBounds(min, max);    
}

function getCurrentZones(map: google.maps.Map) {
    if (map.getZoom() < 11) {
        return ["z"];
    } 

    const mapBounds = map.getBounds();
    const overlapping = zones.filter(z => mapBounds?.intersects(toBounds(z.bounds))).map(z => "" + z.id);
    return overlapping.length == 0 ? ["z"] : overlapping;
}

const highlightColour = "#FF5500";
const selectedColour = "#0055FF";
let selectedCoords = "";

function getUrlCoords(url: string) {
    const lastSlash = url.lastIndexOf("/");
    return lastSlash === -1 ? "" : url.substr(lastSlash + 1);
}

function createTooltip(map: google.maps.Map) {

    const tooltip = new google.maps.InfoWindow();

    let tooltipTimer: number | undefined = undefined;

    function cancel() {
        if (tooltipTimer !== undefined) {
            clearTimeout(tooltipTimer);
        }
        tooltipTimer = undefined;
        tooltip.close();
    }

    function show(at: PolyPoints, content: string) {
        cancel();

        tooltipTimer = window.setTimeout(() => {
            tooltipTimer = undefined;
            tooltip.setPosition(toBounds(at).getCenter());
            tooltip.setOptions({ content });
            tooltip.open(map);
        }, 1000);
    }

    return {
        cancel, show
    };
}

function showCells(map: google.maps.Map, id: string) {
    
    const tooltip = createTooltip(map);
    
    const zone = zones.filter(z => "" + z.id === id)[0];

    const polygons: google.maps.Polygon[] = [];

    const decompressed = decompressFromBase64(zone.cells);

    const cells = JSON.parse(decompressed!) as Cell[];

    for (const cell of cells) {
        const cellColour = getUrlCoords(cell.url) === selectedCoords ? selectedColour : highlightColour;

        const poly = new google.maps.Polygon({
            paths: cell.bounds,
            strokeColor: cellColour,
            strokeOpacity: 0.5,
            strokeWeight: 2,
            fillColor: cellColour,
            fillOpacity: 0.2,            
        });

        poly.addListener("click", () => {
            const centre = map.getCenter();
            history.pushState(null, "Map location", "?" + JSON.stringify([
                map.getZoom(), centre.lng(), centre.lat(), getUrlCoords(cell.url)
            ]));
            location.assign(cell.url);
        });

        poly.addListener("mouseover", () => {
            poly.setOptions({ strokeOpacity: 1, strokeWeight: 4, strokeColor: selectedColour });            
            tooltip.show(cell.bounds, "Click me to time travel to 1986!");            
        });

        poly.addListener("mouseout", () => {
            poly.setOptions({ strokeOpacity: 0.5, strokeWeight: 2, strokeColor: highlightColour });
            tooltip.cancel();
        })

        poly.setMap(map);
        polygons.push(poly);
    }

    return () => {
        for (const poly of polygons) {
            poly.setMap(null);
        }

        tooltip.cancel();   
    };
}

function showZones(map: google.maps.Map) {
    const tooltip = createTooltip(map);

    const polygons: google.maps.Polygon[] = [];

    for (const zone of zones) {
        const poly = new google.maps.Polygon({
            paths: zone.bounds,
            strokeColor: "transparent",
            fillColor: highlightColour,
            fillOpacity: zone.cellCount / 100,
        });
        poly.setMap(map);
        polygons.push(poly);

        poly.addListener("mouseover", () => {            
            tooltip.show(zone.bounds, `This zone contains ${zone.cellCount} cells, so keep zooming...`);
        });

        poly.addListener("mouseout", () => {            
            tooltip.cancel();
        })
    }

    return () => {
        for (const poly of polygons) {
            poly.setMap(null);
        }
        tooltip.cancel();
    };
}

function parseQuery() {
    if (location.search.length > 2) {
        try {
            const parsed = JSON.parse(decodeURI(location.search.substr(1)));
            selectedCoords = parsed[3];
            return {
                zoom: parsed[0],
                center: {
                    lng: parsed[1],
                    lat: parsed[2]
                }
            };
        } catch (x) {
            console.error("Failed to parse query string: " + location.search);
        }
    }

    return {
        center: { lat: 54.4, lng: -4 },
        zoom: 6
    };
}

const loader = new Loader({
    apiKey: "AIzaSyAutrz3_IXe0t1wAgcgWxN2eoszvRRI2KU",
    version: "weekly"
});

loader.load().then(() => {
    const elem = document.querySelector(".map") as HTMLElement;

    const map = new google.maps.Map(elem, parseQuery());

    let active: { [id: string]: () => void } = {};

    function updateCurrentZone() {
        const requiredIds = getCurrentZones(map);
        const activeIds = Object.keys(active);
        const removingIds = activeIds.filter(id => !requiredIds.some(r => r + "" == id));
        const addingIds = requiredIds.filter(r => !active[r]);

        for (const id of removingIds) {
            active[id]();
            delete active[id];
        }

        for (const adding of addingIds) {
            active[adding] = adding === "z" ? showZones(map) : showCells(map, adding);
        }

        const msg = active["z"] 
            ? "Zoom in further to see individual cells"
            : "Click on a cell to see the archived content from 1986";

        document.querySelector(".prompt")!.innerHTML = msg;
    }
    
    map.addListener("idle", updateCurrentZone);
    map.addListener("center_changed", updateCurrentZone);
    map.addListener("zoom_changed", updateCurrentZone); 

    function handleNavigate() {
        const at = parseQuery();
        map.setCenter(at.center);
        map.setZoom(at.zoom);
    }

    window.addEventListener("popstate", handleNavigate);    
});
