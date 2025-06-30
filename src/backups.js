//import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
//const searchOptions = document.getElementById("select-search-options");
//
// const geocoderApi = {
//   forwardGeocode: async (config) => {
//     let location = "";
//     const features = [];
//     if (searchOptions.value === "artist") {
//       try {
//         const mbApiResult = await mbApi.search("artist", {
//           query: `${config.query}`,
//         });
//         const mbApiResultCity = mbApiResult.artists.find(
//           (artist) => artist.name.toLowerCase() == config.query.toLowerCase(),
//         )["begin-area"]["name"];
//         const mbApiResultCountry = mbApiResult.artists.find(
//           (artist) => artist.name.toLowerCase() == config.query.toLowerCase(),
//         )["country"];
//         if (typeof mbApiResultCountry !== "undefined") {
//           location = `${mbApiResultCity}, ${mbApiResultCountry}`;
//         } else location = mbApiResultCity;
//         origin.setAttribute("style", "display: block;");
//         origin.innerHTML = location;
//       } catch (error) {
//         console.error("Error parsing artist's properties\n", error);
//       }
//     }
//     if (searchOptions.value === "area") {
//       location = config.query;
//       try {
//         const request = `https://nominatim.openstreetmap.org/search?q=${
//           location
//         }&format=geojson&polygon_geojson=1&addressdetails=1`;
//         const response = await fetch(request);
//         const geojson = await response.json();
//         for (const feature of geojson.features) {
//           const center = [
//             feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
//             feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2,
//           ];
//           const point = {
//             type: "Feature",
//             geometry: {
//               type: "Point",
//               coordinates: center,
//             },
//             place_name: feature.properties.display_name,
//             country_code: feature.properties.address.country_code,
//             city: feature.properties.address.city,
//             properties: feature.properties,
//             text: feature.properties.display_name,
//             place_type: ["place"],
//             center,
//           };
//           features.push(point);
//         }
//         //console.log(features);
//       } catch (e) {
//         console.error(`Failed to forwardGeocode with error: ${e}`);
//       }
//       return {
//         features,
//       };
//     }
//   },
// };

// const geocoder = new MaplibreGeocoder(geocoderApi, {
//   //showResultsWhileTyping: true,
//   minLength: 3,
//   maplibregl,
// });

// const geocoderContainer = document.getElementById("geocoder-container");
// geocoderContainer.appendChild(geocoder.onAdd(map));
// const artistOption = document.createElement("option");
// artistOption.id = "artist-option";
// artistOption.innerHTML = "artist";
// const areaOption = document.createElement("option");
// areaOption.id = "area-option";
// areaOption.innerHTML = "area";
// const selectSearchOptions = document.createElement("select");
// selectSearchOptions.id = "select-search-options";
// selectSearchOptions.options.add(artistOption);
// selectSearchOptions.options.add(areaOption);
// geocoderContainer.appendChild(selectSearchOptions);

// geocoder.on("result", (e) => {
//   clearResult();
//   //console.log(e.result);
//   //searchAndDisplayArtists(e.result.city, e.result.country_code);
// });
