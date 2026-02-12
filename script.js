// Register Chart.js Plugin
if (typeof ChartAnnotation !== 'undefined') { Chart.register(ChartAnnotation); }

let currentCoords = { lat: 21.4225, lon: 39.8262 };
let chartInstance = null;

const KEY_EVENTS = {
    "17-9": "Battle of Badr",
    "1-10": "Eid al-Fitr",
    "10-12": "Eid al-Adha"
};

document.addEventListener('DOMContentLoaded', () => {
    setupSelectors();
    useCurrentLocation(); 
});

function logStatus(msg) {
    const log = document.getElementById('statusLog');
    if (log) {
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        log.innerText = `[${time}] > ${msg}`;
    }
}

function setupSelectors() {
    const mSelect = document.getElementById('monthSelect');
    const ySelect = document.getElementById('yearSelect');
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    mSelect.innerHTML = months.map((m, i) => `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    const currentYear = new Date().getFullYear();
    for(let i = currentYear - 1; i <= currentYear + 1; i++) {
        ySelect.innerHTML += `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`;
    }
}

async function safeFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (e) {
        // Fallback: Use a CORS proxy if the direct request fails
        logStatus(`Direct fetch failed, trying proxy for: ${url.split('v1/')[1].split('?')[0]}`);
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();
        return JSON.parse(json.contents);
    }
}

async function useCurrentLocation() {
    const btn = document.getElementById('gpsBtn');
    btn.disabled = true;
    logStatus("Detecting GPS...");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            await fetchLocationName(currentCoords.lat, currentCoords.lon);
            refreshUI();
            btn.disabled = false;
        }, () => {
            logStatus("GPS Offline. Using Mecca default.");
            btn.disabled = false;
            refreshUI();
        }, { timeout: 6000 });
    }
}

async function fetchLocationName(lat, lon) {
    try {
        const data = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const city = data.address.city || data.address.town || data.address.village || "Detected Area";
        document.getElementById('locDisplay').innerText = city;
    } catch (e) { logStatus("Address name lookup failed."); }
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    if (!city) return;
    logStatus(`Searching: ${city}`);
    try {
        const data = await safeFetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        if (data && data.length > 0) {
            currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
            refreshUI();
        }
    } catch (e) { logStatus("Manual search failed."); }
}

function refreshUI() {
    updateCalendar();
    updateChart();
}

async function updateCalendar() {
    const m = document.getElementById('monthSelect').value;
    const y = document.getElementById('yearSelect').value;
    logStatus(`Syncing schedule for ${m}/${y}...`);
    try {
        const url = `https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`;
        const result = await safeFetch(url);
        
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = result.data.map(day => {
            const isRamadan = day.hijri.month.number === 9;
            const eventKey = `${parseInt(day.hijri.day)}-${day.hijri.month.number}`;
            const eventName = KEY_EVENTS[eventKey] || (day.hijri.holidays[0] || "");
            return `<tr class="${isRamadan ? 'ramadan-row' : ''}">
                <td>${day.hijri.day} ${day.hijri.month.en} ${day.hijri.year} ${eventName ? `<span class="event-badge">${eventName}</span>` : ''}</td>
                <td>${day.timings.Fajr.split(' ')[0]}</td>
                <td>${day.timings.Dhuhr.split(' ')[0]}</td>
                <td>${day.timings.Asr.split(' ')[0]}</td>
                <td>${day.timings.Maghrib.split(' ')[0]}</td>
                <td>${day.timings.Isha.split(' ')[0]}</td>
            </tr>`;
        }).join('');
        
        const d = new Date();
        if (d.getMonth() + 1 == m && d.getFullYear() == y) {
            displayToday(result.data[d.getDate()-1].timings);
            document.getElementById('dateDisplay').innerText = d.toDateString();
        }
    } catch (e) { logStatus("Calendar connection failed."); }
}

function displayToday(t) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `<div class="prayer-box"><h3>${k}</h3><p>${t[k].split(' ')[0]}</p></div>`).join('');
}

async function updateChart() {
    const timespan = parseInt(document.getElementById('timespanSelect').value);
    logStatus(`Fetching graph data (${timespan} months)...`);
    let combinedData = [];
    let startM = new Date().getMonth() + 1;
    let startY = new Date().getFullYear();

    try {
        for (let i = 0; i < timespan; i++) {
            let m = ((startM + i - 1) % 12) + 1;
            let y = startY + Math.floor((startM + i - 1) / 12);
            const url = `https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`;
            const json = await safeFetch(url);
            if (json.data) combinedData = combinedData.concat(json.data);
            if (timespan > 1) await new Promise(r => setTimeout(r, 200)); 
        }
        renderChart(combinedData);
        logStatus("Graph updated successfully.");
    } catch (e) { logStatus("Error: Could not render graph."); }
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
            annos['ram'+i] = { type: 'box', xMin: i, xMax: i + 1, backgroundColor: 'rgba(251, 191, 36, 0.15)', borderWidth: 0, drawTime: 'beforeDatasetsDraw' };
        }
        const eventKey = `${parseInt(d.hijri.day)}-${d.hijri.month.number}`;
        if (KEY_EVENTS[eventKey]) {
            annos['ev'+i] = { type: 'line', xMin: i, xMax: i, borderColor: '#ef4444', borderWidth: 2, label: { content: KEY_EVENTS[eventKey], display: true, position: 'start', backgroundColor: '#ef4444', font: {size: 10} } };
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
                y: { ticks: { color: '#fff', callback: v => Math.floor(v) + ":00" }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#fff', maxTicksLimit: 10 }, grid: { display: false } }
            }
        }
    });
}
