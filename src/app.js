import maplibregl from "maplibre-gl";
import { MusicBrainzApi } from "musicbrainz-api";
import "maplibre-gl/dist/maplibre-gl.css";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

// Constants
const MAP_STYLES = {
	dark: "https://tiles.openfreemap.org/styles/dark",
	bright: "https://tiles.openfreemap.org/styles/bright",
	liberty: "https://tiles.openfreemap.org/styles/liberty",
};

const MUSIC_GENRES = [
	"All",
	"Pop",
	"Rap",
	"Hip-Hop",
	"Rock",
	"Metal",
	"EDM",
	"R&B",
	"Soul",
	"Country",
	"Jazz",
	"Classical",
	"Latin",
]

const ARTIST_TYPES = [
	"All",
	"Artist",
	"Group",
]

// DOM Elements
const elements = {
	origin: document.getElementById("origin"),
	artistList: document.getElementById("artist-list"),
	artistsRange: document.getElementById("artists-range"),
	artistsRangeValue: document.getElementById("artists-range-value"),
	mapStyleSelector: document.getElementById("map-style-selector"),
	genreSelector: document.getElementById("genre-selector"),
	artistTypeSelector: document.getElementById("artist-type-selector"),
};

// State
const state = {
	dots: [],
	circleCoords: {},
	saveMapStateTimeout: null,
	currentController: new AbortController(),
};

// Initialize UI
function initializeUI() {
	// Set up map style selector
	for (const style in MAP_STYLES) {
		const styleOption = document.createElement("option");
		styleOption.value = style;
		styleOption.textContent = style.charAt(0).toUpperCase() + style.slice(1);
		elements.mapStyleSelector.appendChild(styleOption);
	}

	// Initialize range display
	elements.artistsRangeValue.textContent = elements.artistsRange.value;
	elements.artistsRange.oninput = () => {
		elements.artistsRangeValue.textContent = elements.artistsRange.value;
	};

	// Initialize genre selector
	for (const i in MUSIC_GENRES) {
		const genreOption = document.createElement("option");
		genreOption.value = MUSIC_GENRES[i];
		genreOption.textContent = MUSIC_GENRES[i];
		elements.genreSelector.appendChild(genreOption);
	}

	for (const i in ARTIST_TYPES) {
		const artistTypeOption = document.createElement("option");
		artistTypeOption.value = ARTIST_TYPES[i],
			artistTypeOption.textContent = ARTIST_TYPES[i];
		elements.artistTypeSelector.appendChild(artistTypeOption);
	}
}

// Map Initialization
function initializeMap() {
	const map = new maplibregl.Map({
		container: "map",
		style: MAP_STYLES.dark,
		center: [0, 0],
		zoom: 6,
	});

	// Initialize draw tools
	const draw = new MaplibreTerradrawControl({
		modes: ['render', 'circle', 'delete-selection', 'delete'],
		open: true,
	});
	map.addControl(draw, 'top-left');

	return { map, draw };
}

// Marker and Popup
function createMarkerAndPopup() {
	const customMarker = document.createElement('div');
	customMarker.className = 'marker';

	const marker = new maplibregl.Marker({ element: customMarker, offset: [0, -15] });
	const popup = new maplibregl.Popup({
		closeOnClick: false,
		focusAfterOpen: true,
	});

	popup.on("close", clearScreen);
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") clearScreen();
	});

	return { marker, popup };
}

// Event Handlers
function setupEventHandlers(map, draw, marker, popup) {
	const terraDrawInstance = draw.getTerraDrawInstance();

	// Map style change
	elements.mapStyleSelector.addEventListener("change", handleStyleChange(map));

	// Map events
	map.on("error", (e) => console.error("Map error: ", e.error));
	map.on("load", () => loadMapState(map));
	map.on("move", () => saveMapState(map));
	map.on("zoom", () => saveMapState(map));

	// Draw events
	draw.on("feature-deleted", () => {
		state.circleCoords = {};
		state.dots.forEach(dot => dot.marker.remove());
		state.dots.length = 0;
	});

	terraDrawInstance.on("finish", async () => {
		const polygonFeature = getFirstPolygonFeature(terraDrawInstance);
		if (polygonFeature) {
			terraDrawInstance.setMode("static");
			try {
				const result = await tryQuery(
					state.circleCoords.lng,
					state.circleCoords.lat,
					polygonFeature?.properties?.radiusKilometers,
					100
				);
				processQueryResult(result, map);
			} catch (error) {
				console.error("Error querying the area:", error);
			}
		}
	});

	map.on("click", async (e) => {
		if (Object.keys(state.circleCoords).length === 0) {
			state.circleCoords = e.lngLat;
		}
		const polygonFeature = getFirstPolygonFeature(terraDrawInstance);

		if (terraDrawInstance.getMode() !== "circle" && !polygonFeature) {
			await handleMapClick(e, map, marker, popup);
		}
	});
}

async function handleMapClick(e, map, marker, popup) {
	clearScreen();
	try {
		marker.setLngLat(e.lngLat).addTo(map);
		const location = await getLocationOnClick(e.lngLat.lng, e.lngLat.lat);
		marker.setLngLat(location.coordinates);
		map.flyTo({ center: location.coordinates, offset: [0.0, 125.0], zoom: 7 });

		if (location.mbid) {
			await displayArtistsFromLocation(location, popup);
		} else {
			displayNoArtistsPopup(location.coordinates, popup);
		}
	} catch (error) {
		console.error("Error handling click:", error);
	}
}

async function displayArtistsFromLocation(location, popup) {
	const artists = await getArtistsFromArea(location.mbid);
	const n = parseInt(elements.artistsRangeValue.textContent);
	const randomArtists = artists ? getRandomArtists(artists, n) : null;
	const nRandomArtists = randomArtists?.length;

	if (!nRandomArtists || nRandomArtists <= 0) {
		clearScreen();
		return;
	}

	// Update UI if we got fewer artists than requested
	if (nRandomArtists !== n && nRandomArtists > 0) {
		elements.artistsRange.value = nRandomArtists.toString();
		elements.artistsRangeValue.textContent = nRandomArtists.toString();
	}

	elements.origin.textContent = `${location.city}, ${location.country}`;
	elements.origin.style.display = "flex";
	elements.artistList.style.display = "block";

	const artistInfo = document.createElement("p");
	artistInfo.id = "artist-info";
	artistInfo.innerHTML = `<b>${nRandomArtists} Artists from ${location.city}, ${location.country}</b>`;
	elements.artistList.appendChild(artistInfo);

	randomArtists.forEach(artist => {
		const ul = document.createElement("ul");
		ul.textContent = artist.name;
		elements.artistList.appendChild(ul);
	});

	const artistsContainer = document.getElementById("artists-container");
	if (artistsContainer) {
		showPopup(location.coordinates, artistsContainer.innerHTML, popup);
		popup.on("close", () => {
			if (elements.artistsRange.value !== n.toString()) {
				elements.artistsRangeValue.textContent = n.toString();
				elements.artistsRange.value = n.toString();
			}
		});
	}
}

function displayNoArtistsPopup(coords, popup) {
	const noArtists = document.createElement("div");
	noArtists.textContent = "No artists at this location!";
	showPopup(coords, noArtists.innerHTML, popup);
}

// Helper Functions
async function getLocationOnClick(lng, lat) {
	let result = await tryQuery(lng, lat, 3, 1);
	if (!result?.results?.bindings?.length) {
		result = await tryQuery(lng, lat, 50, 1);
	}

	const data = result?.results?.bindings[0];
	const coordsMatch = data?.coords?.value?.match(/-?\d+\.\d+/g);

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

async function tryQuery(lng, lat, radius, limit) {
	if (state.currentController) state.currentController.abort();
	state.currentController = new AbortController();

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
        VALUES ?majorCities { wd:Q60 wd:Q84 wd:Q90 }
        ?city wdt:P31 ?majorCities .
        FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }
      }
      UNION
      {
        # Second priority: Official city designation
        ?city wdt:P31 wd:Q515 .
        FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }
      }
      UNION
      {
        # Third priority: Large urban settlements
        ?city wdt:P31/wdt:P279* wd:Q486972 .
        ?city wdt:P1082 ?pop .
        FILTER(?pop > 14000)
        FILTER NOT EXISTS { ?city wdt:P31/wdt:P279* wd:Q3497294 }
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
		`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
		{ signal: state.currentController.signal }
	);
	return await response.json();
}

function processQueryResult(result, map) {
	const locations = result?.results?.bindings;
	if (!locations) return;

	state.dots = locations.map(loc => {
		const match = loc?.coords?.value.match?.(/-?\d+\.\d+/g);
		if (!match) return null;

		const coords = { lng: parseFloat(match[0]), lat: parseFloat(match[1]) };
		const customDot = document.createElement('div');
		customDot.className = 'dot';

		return {
			marker: new maplibregl.Marker({ element: customDot }).setLngLat(coords).addTo(map),
			city: loc?.cityLabel?.value || "Unknown",
			country: loc?.countryLabel?.value || "Unknown",
			mbid: loc?.mbid?.value || null,
			coordinates: coords
		};
	}).filter(Boolean);
	console.log(state.dots);
}

function clearScreen() {
	state.circleCoords = {};
	state.dots.forEach(dot => dot.marker.remove());
	state.dots.length = 0;

	state.marker?.remove();
	state.popup?.remove();
	state.draw?.deactivate();

	['maplibrelg-marker', 'location-radius-outline', 'location-radius'].forEach(layer => {
		if (state.map.getLayer(layer)) state.map.removeLayer(layer);
	});

	if (state.map.getSource("location-radius")) {
		state.map.removeSource("location-radius");
	}

	elements.origin.textContent = "";
	elements.origin.style.display = "none";
	elements.artistList.textContent = "";
	elements.artistList.style.display = "none";
}

function saveMapState(map) {
	clearTimeout(state.saveMapStateTimeout);
	state.saveMapStateTimeout = setTimeout(() => {
		const center = map.getCenter();
		localStorage.setItem("mapState", JSON.stringify({
			lng: center.lng,
			lat: center.lat,
			zoom: map.getZoom(),
		}));
	}, 500);
}

function loadMapState(map) {
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

function showPopup(coords, content, popup) {
	popup
		.setLngLat(coords)
		.setMaxWidth("none")
		.setOffset(45)
		.setHTML(content)
		.addTo(state.map);
}

function getFirstPolygonFeature(terraDrawInstance) {
	const features = terraDrawInstance.getSnapshot();
	return features.find(feature => feature.geometry.type === "Polygon");
}

function handleStyleChange(map) {
	return (e) => {
		const selectedStyle = e.target.value.toLowerCase();

		if (MAP_STYLES[selectedStyle]) {
			localStorage.setItem("mapStyle", selectedStyle);

			const canvas = map.getCanvas();
			canvas.style.transition = "opacity 0.5s";
			canvas.style.opacity = "0";

			setTimeout(() => {
				map.setStyle(MAP_STYLES[selectedStyle]);
				map.once("styledata", () => {
					canvas.style.opacity = "1";
				});
			}, 500);
		}
	};
}

// MusicBrainz API
const mbApi = new MusicBrainzApi({
	appName: "artist-map",
	appVersion: "0.0.1",
	appContactInfo: "junk4cc806@gmail.com",
});

async function getArtistsFromArea(areaMBID) {
	const selectedGenre = elements.genreSelector.value;
	console.log(selectedGenre);
	let response;
	try {
		if (selectedGenre === "All") {
			response = await mbApi.browse("artist", {
				area: areaMBID,
				limit: 100,
			});
		} else {
			response = await mbApi.search("artist", {
				area: areaMBID,
				tag: selectedGenre,
				limit: 100,
			})
		}
		console.log(response);
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

// Main Initialization
function init() {
	initializeUI();

	const { map, draw } = initializeMap();
	const { marker, popup } = createMarkerAndPopup();

	// Store references in state
	state.map = map;
	state.draw = draw;
	state.marker = marker;
	state.popup = popup;

	setupEventHandlers(map, draw, marker, popup);

	// Load saved style
	const savedStyle = localStorage.getItem("mapStyle");
	if (savedStyle && MAP_STYLES[savedStyle]) {
		elements.mapStyleSelector.value = savedStyle;
		map.setStyle(MAP_STYLES[savedStyle]);
	}
}

// Start the application
init();
