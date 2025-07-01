import maplibregl from "maplibre-gl";
import { MusicBrainzApi } from "musicbrainz-api";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

const styles = {
	dark: "https://tiles.openfreemap.org/styles/dark",
	bright: "https://tiles.openfreemap.org/styles/bright",
	liberty: "https://tiles.openfreemap.org/styles/liberty",
};

const customMarker = document.createElement('div');
customMarker.className = 'marker';
const dots = [];

const origin = document.getElementById("origin");
const artistList = document.getElementById("artist-list");
const artistsRange = document.getElementById("artists-range");
const artistsRangeValue = document.getElementById("artists-range-value");
artistsRangeValue.innerText = artistsRange.value;
const mapStyleSelector = document.getElementById(
	"map-style-selector",
);

// Load map styles into a map style selector
for (const style in styles) {
	const option = document.createElement("option");
	option.value = style;
	option.innerHTML = style.charAt(0).toUpperCase() + style.slice(1);
	mapStyleSelector.appendChild(option);
}

// Initialize MusicBrainzApi to search for artists
const mbApi = new MusicBrainzApi({
	appName: "artist-map",
	appVersion: "0.0.1",
	appContactInfo: "junk4cc806@gmail.com",
});

// Initialize the map with custom options
const map = new maplibregl.Map({
	container: "map",
	style: "https://tiles.openfreemap.org/styles/dark",
	center: [0, 0],
	zoom: 6,
});

// Initialize draw tools
const draw = new MaplibreTerradrawControl({
	modes: [
		'render',
		'circle',
		'delete-selection',
		'delete',
	],
	open: true,
});

// Add drawing tools to the map
map.addControl(draw, 'top-left');

// Extract the terraDrawInstance to access it's methods like "getSnapshot(), getMode(), etc."
const terraDrawInstance = draw.getTerraDrawInstance();

let circleCoords = {};
let saveMapStateTimeout;

// Initialize custom map markers and popup
const marker = new maplibregl.Marker({ element: customMarker, offset: [0, -15] });
const popup = new maplibregl.Popup({
	closeOnClick: false,
	focusAfterOpen: true,
});
popup.on("close", () => clearScreen());

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") clearScreen();
});

artistsRange.oninput = function() {
	artistsRangeValue.innerText = artistsRange.value;
}

// Listen for changes on a map style selector for style switching
mapStyleSelector.addEventListener("change", (e) => {
	const target = e.target;
	const selectedStyle = target.value.toLowerCase();

	// Store current style between sessions
	if (styles[selectedStyle]) {
		localStorage.setItem("mapStyle", selectedStyle);
	}
	// 0.5s transition effect
	const canvas = map.getCanvas();
	canvas.style.transition = "opacity 0.5s";
	canvas.style.opacity = "0";

	// Change map's style with a 500ms timeout for loading purposes
	setTimeout(() => {
		if (styles[selectedStyle]) {
			map.setStyle(styles[selectedStyle]);
		}
		map.once("styledata", () => {
			canvas.style.opacity = "1";
		});
	}, 500);
});

// Handle any mpa errors that may come up
map.on("error", (e) => {
	console.error("Map error: ", e.error);
});

// Load previous map state when it loads
// Save map state when movement or zoom is detected
map.on("load", loadMapState);
map.on("move", saveMapState);
map.on("zoom", saveMapState);

draw.on("feature-deleted", () => {
	dots.forEach(dot => dot.remove());
	dots.length = 0;
});

terraDrawInstance.on("finish", async () => {
	const polygonFeature = getFirstPolygonFeature(terraDrawInstance);
	console.log(polygonFeature);
	if (polygonFeature) {
		terraDrawInstance.setMode("static");
		try {
			const result = await tryQuery(circleCoords.lng, circleCoords.lat, polygonFeature?.properties?.radiusKilometers, 100);
			const locations = result?.results?.bindings;
			const coords = locations.map(loc => {
				const match = loc?.coords?.value.match?.(/-?\d+\.\d+/g);
				if (match) {
					return { lng: parseFloat(match[0]), lat: parseFloat(match[1]) }
				}
			});

			for (const coord in coords) {
				const customDot = document.createElement('div');
				customDot.className = 'dot';
				const dot = new maplibregl.Marker({ element: customDot })
				dot.setLngLat(coords[coord]).addTo(map);
				dots.push(dot);
			}
			console.log(dots);
		}
		catch (error) {
			console.error("Error querrying the area:", error);
		}
	}
})

map.on("click", async (e) => {
	if (circleCoords = {}) {
		circleCoords = e.lngLat;
	}
	const polygonFeature = getFirstPolygonFeature(terraDrawInstance);
	if (terraDrawInstance.getMode() !== "circle" && !polygonFeature) {
		clearScreen();
		try {
			marker.setLngLat(e.lngLat).addTo(map);
			const location = await getLocationOnClick(e.lngLat.lng, e.lngLat.lat);
			marker.setLngLat(location.coordinates)
			map.flyTo({ center: location.coordinates, offset: [0.0, 125.0], zoom: 7 })
			if (location.mbid) {
				const artists = await getArtistsFromArea(location.mbid);
				const n = parseInt(artistsRangeValue.innerText);
				const randomArtists = artists ? getRandomArtists(artists, n) : null;
				const nRandomArtists = randomArtists?.length;

				if (nRandomArtists && nRandomArtists !== n && nRandomArtists > 0) {
					artistsRange.value = nRandomArtists.toString();
					artistsRangeValue.innerText = nRandomArtists.toString();
				}
				if (nRandomArtists && nRandomArtists > 0) {
					origin.innerHTML = `${location.city}, ${location.country}`;
					origin.style.display = "flex";
					artistList.style.display = "block";
					const p = document.createElement("p");
					p.id = "artist-info";
					p.innerHTML = `<b>${n} Artists from ${location.city}, ${location.country}</b>`;
					artistList.appendChild(p);

					randomArtists.forEach((a) => {
						const ul = document.createElement("ul");
						ul.innerHTML = a.name;
						artistList.appendChild(ul);
					});

					const artistsContainer = document.getElementById("artists-container")
					if (artistsContainer) {
						showPopup(location.coordinates, artistsContainer.innerHTML);
						popup.on("close", () => {
							if (artistsRange.value !== n.toString()) {
								artistsRangeValue.innerText = n.toString();
								artistsRange.value = n.toString();
							}
						});
					}
				} else {
					clearScreen();
				}
			} else {
				const noArtists = document.createElement("div");
				noArtists.innerText = "No artists at this location!";
				showPopup(location.coordinates, noArtists.innerHTML);
			}
		} catch (error) {
			console.error("Error handling click:", error);
		}
	}
});

// Preserve map style between sessions
const savedStyle = localStorage.getItem("mapStyle");
if (savedStyle && styles[savedStyle]) {
	mapStyleSelector.value = savedStyle;
	map.setStyle(styles[savedStyle]);
}

async function getLocationOnClick(
	lng,
	lat,
) {
	let result = await tryQuery(lng, lat, 3, 1);
	if (!result || !result.results || result.results.bindings.length === 0) {
		result = await tryQuery(lng, lat, 50, 1);
	}
	const data = result?.results?.bindings[0];
	const coordsMatch = data?.coords?.value?.match(/-?\d+\.\d+/g)
	return {
		city: data?.cityLabel?.value || "Unknown",
		country: data?.countryLabel?.value || "Unknown",
		mbid: data?.mbid?.value || null,
		coordinates: {
			lng: coordsMatch ? parseFloat(coordsMatch[0]) : lng,
			lat: coordsMatch ? parseFloat(coordsMatch[1]) : lat,
		},
	};
}

let currentController = new AbortController();

async function tryQuery(
	lng,
	lat,
	radius, limit
) {
	if (currentController) currentController.abort();
	currentController = new AbortController();
	const sparql = `
    #pragma hint.timeout 3000
         SELECT DISTINCT ?city ?cityLabel ?country ?countryLabel ?coords ?mbid WHERE {
           SERVICE wikibase:around {
             ?city wdt:P625 ?coords .
             bd:serviceParam wikibase:center "POINT(${lng} ${lat})"^^geo:wktLiteral;
                            wikibase:radius "${radius}";
                            wikibase:timeout 2000.
           }

           # Strict city definition with priority system
           {
             # First priority: Major global cities
             VALUES ?majorCities { wd:Q60 wd:Q84 wd:Q90 }  # NYC, London, Paris
             ?city wdt:P31 ?majorCities .
             FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }  # Exclude districts
             }
           UNION
           {
             # Second priority: Official city designation
             ?city wdt:P31 wd:Q515 .  # City proper
             FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }  # Exclude districts
           }
           UNION
           {
             # Third priority: Large urban settlements
             ?city wdt:P31/wdt:P279* wd:Q486972 .  # Human settlement
             ?city wdt:P1082 ?pop .  # Population
             FILTER(?pop > 14000)  # Only larger populations
             FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }  # Exclude districts
           }

           # Country information
           { ?city wdt:P17 ?country }
           UNION
           { ?city wdt:P131* ?country . ?country wdt:P31 wd:Q6256 }

           ?city wdt:P982 ?mbid .

           SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
         }
         LIMIT ${limit}
        `;

	const response = await fetch(
		`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`, { signal: currentController.signal }
	);
	return await response.json();
}

async function getArtistsFromArea(areaMBID) {
	try {
		const response = await mbApi.browse("artist", {
			area: areaMBID,
			limit: 100,
		});
		return response.artists;
	} catch (error) {
		console.error("Error browsing artists from area:", error);
		return null;
	}
}

function getRandomArtists(artists, n) {
	try {
		return [...artists].sort(() => Math.random() - 0.5).slice(0, n);
	} catch (error) {
		console.error("Couldn't get random artists:", error);
		return [];
	}
}

function clearScreen() {
	marker.remove();
	popup.remove();
	draw.deactivate();

	if (map.getLayer("maplibrelg-marker")) map.removeLayer("maplibregl-marker");
	if (map.getLayer("location-radius-outline"))
		map.removeLayer("location-radius-outline");
	if (map.getLayer("location-radius")) map.removeLayer("location-radius");
	if (map.getSource("location-radius")) map.removeSource("location-radius");

	origin.innerHTML = "";
	origin.style.display = "none";
	artistList.innerHTML = "";
	artistList.style.display = "none";
}

function saveMapState() {
	clearTimeout(saveMapStateTimeout);
	saveMapStateTimeout = setTimeout(() => {
		const center = map.getCenter();
		localStorage.setItem(
			"mapState",
			JSON.stringify({
				lng: center.lng,
				lat: center.lat,
				zoom: map.getZoom(),
			}),
		);
	}, 500);
}

function loadMapState() {
	const savedState = localStorage.getItem("mapState");
	if (savedState) {
		try {
			const { lng, lat, zoom } = JSON.parse(savedState);
			map.jumpTo({ center: [lng, lat], zoom });
		} catch (error) {
			console.error("Failed to load saved map state:", error);
		}
	}
}

function showPopup(coords, content) {
	popup
		.setLngLat(coords)
		.setMaxWidth("none")
		.setOffset(45)
		.setHTML(content)
		.addTo(map);
}

function getFirstPolygonFeature(terraDrawInstance) {
	const features = terraDrawInstance.getSnapshot();
	const firstPolygonFeature = features.filter(feature => feature.geometry.type === "Polygon")[0];
	return firstPolygonFeature;
}

