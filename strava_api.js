// Constants
const auth_link = "https://www.strava.com/oauth/token";
const segmentTable = document.createElement('table');
const segmentTableBody = document.createElement('tbody');
segmentTable.appendChild(segmentTableBody);
document.body.appendChild(segmentTable);
let tablePopulated = false;

// Function to get activities from user's link
function getActivities(res) {
    const activities_link = `https://www.strava.com/api/v3/athlete/activities?access_token=${res.access_token}`;
    fetch(activities_link)
        .then(res => res.json())
        .then(data => {
            displayActivities(data);
        })
        .catch(error => console.error("Error fetching activities:", error));
}

// Function to display activities on map
function displayActivities(data) {
    data.forEach(activity => {
        if (activity.map && activity.map.summary_polyline) {
            const coordinates = L.Polyline.fromEncoded(activity.map.summary_polyline).getLatLngs();
            L.polyline(coordinates, {
                color: "black",
                weight: 5,
                opacity: .7,
                lineJoin: 'round'
            }).addTo(map);
        }
    });
}

// Function to fetch explore segments
function fetchExploreSegments(bounds, access_token, activityType) {
    const boundsStr = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const explore_segments_link = `https://www.strava.com/api/v3/segments/explore?access_token=${access_token}&bounds=${boundsStr}&activity_type=${activityType}`;
    fetch(explore_segments_link)
        .then(res => res.json())
        .then(data => {
            displayExploreSegments(data);
        })
        .catch(error => {
            console.error("Error fetching explore segments:", error);
        });
}

// Function to display explore segments on map and in table
function displayExploreSegments(data) {
    console.log("Displaying explore segments");
    segmentTableBody.innerHTML = '';
    if (!tablePopulated) {
        console.log("Populating table headers");
        populateTableHeader();
        tablePopulated = true;
    }

    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Find the maximum and minimum distance among segments
    let maxDistance = Number.MIN_VALUE;
    let minDistance = Number.MAX_VALUE;
    data.segments.forEach(segment => {
        if (segment.distance > maxDistance) {
            maxDistance = segment.distance;
        }
        if (segment.distance < minDistance) {
            minDistance = segment.distance;
        }
    });

    // Add data rows and display segment on map with color based on distance
    data.segments.forEach((segment, index) => {
        console.log("Populating data row for segment", segment.name);
        const row = segmentTableBody.insertRow();
        const numberCell = row.insertCell(0);
        const nameCell = row.insertCell(1);
        const distanceCell = row.insertCell(2);
        const avgGradeCell = row.insertCell(3);
        const climbCategoryCell = row.insertCell(4);
        const elev_differenceCell = row.insertCell(5);

        numberCell.textContent = index + 1;
        nameCell.textContent = segment.name || "-";
        distanceCell.textContent = segment.distance !== undefined ? segment.distance.toFixed(1) + " m" : "-";
        avgGradeCell.textContent = segment.avg_grade !== undefined ? segment.avg_grade.toFixed(1) + "%" : "-";
        climbCategoryCell.textContent = segment.climb_category || "-";
        elev_differenceCell.textContent = segment.elev_difference !== undefined ? segment.elev_difference.toFixed(1) + " m" : "-";

        // Calculate the color based on distance gradient
        const gradient = (segment.distance - minDistance) / (maxDistance - minDistance);
        const color = `rgb(${Math.floor(255 * gradient)}, ${Math.floor(255 * (1 - gradient))}, 0)`;

        // Display segment on map with color based on distance
        if (segment.points && segment.points.length > 0) {
            const coordinates = L.Polyline.fromEncoded(segment.points).getLatLngs();
            const polyline = L.polyline(coordinates, {
                color: color,
                weight: 4,
                opacity: .7,
                lineJoin: 'round',
            }).addTo(map);

            // Add popup to the polyline
            const popupContent = `
                <strong>${segment.name || "Unnamed Segment"}</strong><br>
                Distance: ${segment.distance !== undefined ? segment.distance.toFixed(1) + " m" : "-"}<br>
                Average Grade: ${segment.avg_grade !== undefined ? segment.avg_grade.toFixed(1) + "%" : "-"}<br>
                Climb Category: ${segment.climb_category || "-"}<br>
                Elevation Difference: ${segment.elev_difference !== undefined ? segment.elev_difference.toFixed(1) + " m" : "-"}
            `;
            polyline.bindPopup(popupContent);
        }
    });
}

// Function to populate table header
function populateTableHeader() {
    const headers = ['No.', 'Name', 'Distance (Meters)', 'Average Grade', 'Climb Category', 'Elevation Difference (Meters)'];
    const headerRow = segmentTable.createTHead().insertRow();
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
}

// Function to reauthorize and initiate the process
function reAuthorize() {
    fetch(auth_link, {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: '123531',
            client_secret: '5f13787dc01db562f107d5aa36f9fee2541e1eb8',
            refresh_token: '7e98198ecd3c435434e701f79e4fce33f942e9b5',
            grant_type: 'refresh_token'
        })
    })
        .then(res => res.json())
        .then(res => {
            const startLat = parseFloat(document.getElementById('startLat').value);
            const startLng = parseFloat(document.getElementById('startLng').value);
            const zoomLevel = parseInt(document.getElementById('zoomLevel').value);
            const activityType = document.getElementById('activity-type').value;

            map.setView([startLat, startLng], zoomLevel);

            setTimeout(() => {
                fetchExploreSegments(map.getBounds(), res.access_token, activityType);
            }, 500);
        })
        .catch(error => console.error("Error during reauthorization:", error));
}

const map = L.map('map');
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});
const outdoorLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
});

const basemaps = {
    "Street Map": streetLayer,
    "Satellite Map": satelliteLayer,
    "Outdoor Map": outdoorLayer
};

L.control.layers(basemaps).addTo(map);

streetLayer.addTo(map);

document.getElementById('submitBtn').addEventListener('click', function () {
    reAuthorize();
});

// Initiate the process
reAuthorize();