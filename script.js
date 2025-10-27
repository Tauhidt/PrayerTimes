const API_BASE_URL = 'https://api.aladhan.com/v1/timingsByCity';
const PRAYER_NAMES = {
    Fajr: 'Fajr',
    Sunrise: 'Sunrise',
    Dhuhr: 'Dhuhr',
    Asr: 'Asr',
    Maghrib: 'Maghrib',
    Isha: 'Isha'
};

const container = document.getElementById('prayer-times-container');
const locationDisplay = document.getElementById('location-display');
const modal = document.getElementById('location-modal');
const manualLocationBtn = document.getElementById('manual-location-btn');
const closeBtn = document.querySelector('.close-btn');
const saveLocationBtn = document.getElementById('save-location-btn');
const useGpsBtn = document.getElementById('use-gps-btn');
const cityInput = document.getElementById('city-input');
const countryInput = document.getElementById('country-input');
const errorMsg = document.getElementById('manual-location-error');

/**
 * Initializes the application, trying to load data from storage or GPS.
 */
document.addEventListener('DOMContentLoaded', () => {
    let storedLocation = localStorage.getItem('prayerTimesLocation');

    if (storedLocation) {
        // Load manual or saved GPS location
        let loc = JSON.parse(storedLocation);
        locationDisplay.textContent = `Location: ${loc.display}`;
        fetchPrayerTimes(loc.city, loc.country);
    } else {
        // Use device GPS if no location is stored
        getLocationByGPS();
    }

    setupEventListeners();
});

/**
 * Sets up listeners for buttons and modal interactions.
 */
function setupEventListeners() {
    manualLocationBtn.onclick = () => {
        modal.style.display = 'block';
        cityInput.value = '';
        countryInput.value = '';
        errorMsg.textContent = '';
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    saveLocationBtn.onclick = () => {
        const city = cityInput.value.trim();
        const country = countryInput.value.trim();
        if (city && country) {
            saveAndFetchManualLocation(city, country);
            modal.style.display = 'none';
        } else {
            errorMsg.textContent = 'Please enter both a City and a Country.';
        }
    };

    useGpsBtn.onclick = () => {
        modal.style.display = 'none';
        getLocationByGPS();
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * Saves and fetches prayer times for a manually entered location.
 */
function saveAndFetchManualLocation(city, country) {
    const locData = {
        city: city,
        country: country,
        display: `${city}, ${country} (Manual)`
    };
    localStorage.setItem('prayerTimesLocation', JSON.stringify(locData));
    locationDisplay.textContent = `Location: ${locData.display}`;
    fetchPrayerTimes(city, country);
}

/**
 * Uses the browser's Geolocation API to find the device's location.
 */
function getLocationByGPS() {
    locationDisplay.textContent = 'Getting device location...';
    container.innerHTML = '<div class="loading-message">Waiting for GPS...</div>';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                // For GPS, we use the 'timings' API with coordinates
                fetchPrayerTimesByCoords(latitude, longitude);
            },
            error => {
                console.error('Geolocation Error:', error);
                locationDisplay.textContent = 'Location: GPS Failed. Please set manually.';
                container.innerHTML = '<div class="loading-message">Failed to get GPS location. Please use the "Set Location" option.</div>';
            }
        );
    } else {
        locationDisplay.textContent = 'Location: Geolocation not supported.';
        container.innerHTML = '<div class="loading-message">Geolocation is not supported by this browser. Please set location manually.</div>';
    }
}

/**
 * Fetches prayer times using latitude and longitude.
 */
async function fetchPrayerTimesByCoords(latitude, longitude) {
    const today = new Date();
    const date = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    // Using AlAdhan API's 'timings' endpoint for coordinates
    const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=2`; // Method 2 is ISNA

    locationDisplay.textContent = `Location: Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)} (GPS)`;
    container.innerHTML = '<div class="loading-message">Fetching times...</div>';

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200) {
            const locData = {
                city: 'GPS_LAT_LON', // Placeholder for API calls
                country: 'GPS_LAT_LON', // Placeholder
                display: `Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)} (GPS)`
            };
            // Save the coordinates to local storage (optional, for persistent data)
            localStorage.setItem('prayerTimesLocation', JSON.stringify(locData));
            displayPrayerTimes(data.data.timings);
        } else {
            throw new Error(data.status || 'Failed to fetch prayer times by coordinates.');
        }
    } catch (error) {
        console.error('Error fetching prayer times by coords:', error);
        container.innerHTML = `<div class="loading-message">Error: Could not retrieve times. ${error.message}</div>`;
    }
}


/**
 * Fetches prayer times from the AlAdhan API using city and country.
 */
async function fetchPrayerTimes(city, country) {
    // Current date for fetching the most relevant data
    const today = new Date();
    const date = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    
    // AlAdhan API: method=2 is for ISNA (Islamic Society of North America), a common standard
    const url = `${API_BASE_URL}?city=${city}&country=${country}&date=${date}&method=2`;

    container.innerHTML = '<div class="loading-message">Fetching times...</div>';

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 200) {
            displayPrayerTimes(data.data.timings);
        } else {
            throw new Error(data.status || 'City/Country not found or API failed.');
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        container.innerHTML = `<div class="loading-message">Error: Could not retrieve times for ${city}, ${country}. Check spelling and try again.</div>`;
    }
}

/**
 * Renders the prayer times onto the webpage.
 */
function displayPrayerTimes(timings) {
    container.innerHTML = ''; // Clear the loading message/previous times

    for (const key in PRAYER_NAMES) {
        if (timings[key]) {
            const time = timings[key];
            const name = PRAYER_NAMES[key];
            
            const box = document.createElement('div');
            box.classList.add('prayer-box');

            const nameElement = document.createElement('div');
            nameElement.classList.add('prayer-name');
            nameElement.textContent = name;

            const timeElement = document.createElement('div');
            timeElement.classList.add('prayer-time');
            timeElement.textContent = time;

            box.appendChild(nameElement);
            box.appendChild(timeElement);
            container.appendChild(box);
        }
    }
}
