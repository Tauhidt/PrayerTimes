// Global State
let currentCoords = { lat: 21.4225, lon: 39.8262 }; // Defaults to Mecca
let chartInstance = null;

const KEY_EVENTS = {
    "17-9": "Battle of Badr",
    "1-10": "Eid al-Fitr",
    "10-12": "Eid al-Adha"
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    logStatus("System ready. Detecting location...");
    setupSelectors();
    useCurrentLocation(); 
});

function logStatus(msg) {
    const log = document.getElementById('statusLog');
    if (!log) return;
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    log.innerText = `[${time}] > ${msg}`;
}

function setupSelectors() {
    const mSelect = document.getElementById('monthSelect');
    const ySelect = document.getElementById('yearSelect');
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    
    mSelect.innerHTML = months.map((m, i) => `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    
    const currentYear = new Date().getFullYear();
    let yearsHTML = "";
    for(let i = currentYear - 1; i <= currentYear + 1; i++) {
        yearsHTML += `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`;
    }
    ySelect.innerHTML = yearsHTML;
}

async function useCurrentLocation() {
    const btn = document.getElementById('gpsBtn');
    btn.disabled = true;
    logStatus("Requesting GPS permission...");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            logStatus("GPS Acquired.");
            await fetchLocationName(currentCoords.lat, currentCoords.lon);
            refreshUI();
            btn.disabled = false;
        }, (err) => {
            logStatus("GPS Denied/Timeout. Using default (Mecca).");
            btn.disabled = false;
            refreshUI();
        }, { timeout: 10000 });
    } else {
        logStatus("Geolocation not supported. Using default.");
        refreshUI();
    }
}

async function fetchLocationName(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || "Current Location";
        document.getElementById('locDisplay').innerText = city;
        logStatus(`Address found: ${city}`);
    } catch (e) {
        logStatus("Unable to fetch city name.");
    }
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    if (!city) return;
    logStatus(`Searching: ${city}...`);
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        const data = await resp.json();
        if (data && data.length > 0) {
            currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
            logStatus("Location updated.");
            refreshUI();
        } else {
            logStatus("City not found.");
        }
    } catch (e) {
        logStatus("Search failed. Check connection.");
    }
}

function refreshUI() {
    updateCalendar();
    updateChart();
}

async function updateCalendar() {
    const month = document.getElementById('monthSelect').value;
    const year = document.getElementById('yearSelect').value;
    logStatus(`Fetching calendar ${month}/${year}...`);
    
    try {
        const res = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`);
        const result = await res.json();
        
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = result.data.map(day => {
            const isRamadan = day.hijri.month.number === 9;
            const eventKey = `${parseInt(day.hijri.day)}-${day.hijri.month.number}`;
            const eventName = KEY_EVENTS[eventKey] || (day.hijri.holidays[0] || "");
            
            return `
                <tr class="${isRamadan ? 'ramadan-row' : ''}">
                    <td>${day.hijri.day} ${day.hijri.month.en} ${day.hijri.year} ${eventName ? `<span class="event-badge">${eventName}</span>` : ''}</td>
                    <td>${day.timings.Fajr.split(' ')[0]}</td>
                    <td>${day.timings.Dhuhr.split(' ')[0]}</td>
                    <td>${day.timings.Asr.split(' ')[0]}</td>
                    <td>${day.timings.Maghrib.split(' ')[0]}</td>
                    <td>${day.timings.Isha.split(' ')[0]}</td>
                </tr>
            `;
        }).join('');
        
        const d = new Date();
        if (d.getMonth() + 1 == month && d.getFullYear() == year) {
            displayToday(result.data[d.getDate()-1].timings);
            document.getElementById('dateDisplay').innerText = d.toDateString();
        }
        logStatus("Calendar updated.");
    } catch (e) {
        logStatus("Error loading calendar.");
    }
}

function displayToday(t) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `
        <div class="prayer-box"><h3>${k}</h3><p>${t[k].split(' ')[0]}</p></div>
    `).join('');
}

async function updateChart() {
    const monthsToFetch = parseInt(document.getElementById('timespanSelect').value);
    logStatus(`Preparing graph (${monthsToFetch} months)...`);
    
    let allData = [];
    let startM = new Date().getMonth() + 1;
    let startY = new Date().getFullYear();

    try {
        for (let i = 0; i < monthsToFetch; i++) {
            let m = ((startM + i - 1) % 12) + 1;
            let y = startY + Math.floor((startM + i - 1) / 12);
            const res = await fetch(`https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`);
            const json = await res.json();
            allData = allData.concat(json.data);
            if(monthsToFetch > 1) await new Promise(r => setTimeout(r, 50)); 
        }
        renderChart(allData);
        logStatus("Graph rendered successfully.");
    } catch (e) {
        logStatus("Graph rendering failed.");
    }
}

function timeToDec(t) {
    if(!t) return 0;
    const parts = t.split(' ')[0].split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
}

function renderChart(data) {
    const ctx = document.getElementById('prayerChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const annos = {};
    data.forEach((d, i) => {
        if (d.hijri.month.number === 9) {
            annos['ram' + i] = { type: 'box', xMin: i, xMax: i + 1, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderWidth: 0 };
        }
        const eventKey = `${parseInt(d.hijri.day)}-${d.hijri.month.number}`;
        if (KEY_EVENTS[eventKey]) {
            annos['ev' + i] = {
                type: 'line', xMin: i, xMax: i, borderColor: '#ef4444', borderWidth: 2,
                label: { content: KEY_EVENTS[eventKey], display: true, position: 'start', backgroundColor: '#ef4444', font: {size: 10} }
            };
        }
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.readable),
            datasets: [
                { label: 'Fajr', data: data.map(d => timeToDec(d.timings.Fajr)), borderColor: '#fbbf24', tension: 0.1, pointRadius: data.length > 31 ? 0 : 2 },
                { label: 'Dhuhr', data: data.map(d => timeToDec(d.timings.Dhuhr)), borderColor: '#10b981', tension: 0.1, pointRadius: data.length > 31 ? 0 : 2 },
                { label: 'Asr', data: data.map(d => timeToDec(d.timings.Asr)), borderColor: '#f97316', tension: 0.1, pointRadius: data.length > 31 ? 0 : 2 },
                { label: 'Maghrib', data: data.map(d => timeToDec(d.timings.Maghrib)), borderColor: '#8b5cf6', tension: 0.1, pointRadius: data.length > 31 ? 0 : 2 },
                { label: 'Isha', data: data.map(d => timeToDec(d.timings.Isha)), borderColor: '#6366f1', tension: 0.1, pointRadius: data.length > 31 ? 0 : 2 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { annotation: { annotations: annos }, legend: { labels: { color: '#fff' } } },
            scales: {
                y: { ticks: { color: '#fff', callback: v => Math.floor(v) + ":00" }, grid: { color: '#334155' } },
                x: { ticks: { color: '#fff', maxTicksLimit: 12 }, grid: { display: false } }
            }
        }
    });
}
