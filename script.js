if (typeof ChartAnnotation !== 'undefined') { Chart.register(ChartAnnotation); }

let currentCoords = { lat: 21.4225, lon: 39.8262 };
let chartInstance = null;

const KEY_EVENTS = { "17-9": "Battle of Badr", "1-10": "Eid al-Fitr", "10-12": "Eid al-Adha" };

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

// Optimized Fetch with Logic for CORS Issues
async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Limit");
        return await res.json();
    } catch (e) {
        logStatus("Retrying via secondary route...");
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();
        return JSON.parse(json.contents);
    }
}

async function useCurrentLocation() {
    const btn = document.getElementById('gpsBtn');
    btn.disabled = true;
    logStatus("Detecting Location...");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            await fetchLocationName(currentCoords.lat, currentCoords.lon);
            refreshUI();
            btn.disabled = false;
        }, () => {
            logStatus("GPS Access Denied.");
            btn.disabled = false;
            refreshUI();
        }, { timeout: 5000 });
    }
}

async function fetchLocationName(lat, lon) {
    try {
        const data = await safeFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        document.getElementById('locDisplay').innerText = data.address.city || data.address.town || "My Location";
    } catch (e) { logStatus("Address lookup offline."); }
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    if (!city) return;
    try {
        const data = await safeFetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        if (data && data.length > 0) {
            currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
            refreshUI();
        }
    } catch (e) { logStatus("City search failed."); }
}

// CRITICAL FIX: Non-blocking UI Refresh
async function refreshUI() {
    // 1. Get Table and Today's data immediately
    await updateCalendar();
    
    // 2. Start Graph process in background
    updateChart();
}

async function updateCalendar() {
    const m = document.getElementById('monthSelect').value;
    const y = document.getElementById('yearSelect').value;
    logStatus(`Fetching Schedule...`);
    try {
        const url = `https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`;
        const result = await safeFetch(url);
        
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = result.data.map(day => {
            const isRamadan = day.hijri.month.number === 9;
            return `<tr class="${isRamadan ? 'ramadan-row' : ''}">
                <td>${day.hijri.day} ${day.hijri.month.en}</td>
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
        logStatus("Schedule ready.");
    } catch (e) { logStatus("Table update failed."); }
}

function displayToday(t) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `
        <div class="prayer-box"><h3>${k}</h3><p>${t[k].split(' ')[0]}</p></div>
    `).join('');
}

async function updateChart() {
    const loader = document.getElementById('chartLoading');
    const canvas = document.getElementById('prayerChart');
    loader.style.display = "block";
    canvas.style.opacity = "0.2";

    const timespan = parseInt(document.getElementById('timespanSelect').value);
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
            if (timespan > 1) await new Promise(r => setTimeout(r, 100));
        }
        renderChart(combinedData);
        loader.style.display = "none";
        canvas.style.opacity = "1";
    } catch (e) { 
        logStatus("Graph loading skipped/failed."); 
        loader.innerText = "Graph unavailable for this location.";
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
            annos['ram'+i] = { type: 'box', xMin: i, xMax: i + 1, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderWidth: 0 };
        }
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.readable),
            datasets: [
                { label: 'Fajr', data: data.map(d => timeToDec(d.timings.Fajr)), borderColor: '#fbbf24', tension: 0.3, pointRadius: 0 },
                { label: 'Maghrib', data: data.map(d => timeToDec(d.timings.Maghrib)), borderColor: '#8b5cf6', tension: 0.3, pointRadius: 0 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { annotation: { annotations: annos }, legend: { labels: { color: '#fff' } } },
            scales: {
                y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { display: false }, grid: { display: false } }
            }
        }
    });
}
