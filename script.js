// Register Plugin
if (typeof ChartAnnotation !== 'undefined') {
    Chart.register(ChartAnnotation);
}

let currentCoords = { lat: 21.4225, lon: 39.8262 };
let chartInstance = null;

const KEY_EVENTS = {
    "17-9": "Battle of Badr",
    "1-10": "Eid al-Fitr",
    "10-12": "Eid al-Adha"
};

document.addEventListener('DOMContentLoaded', () => {
    logStatus("System Ready.");
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

async function useCurrentLocation() {
    const btn = document.getElementById('gpsBtn');
    btn.disabled = true;
    logStatus("Requesting GPS...");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            await fetchLocationName(currentCoords.lat, currentCoords.lon);
            refreshUI();
            btn.disabled = false;
        }, () => {
            logStatus("GPS Access Denied. Falling back to default.");
            btn.disabled = false;
            refreshUI();
        }, { timeout: 8000 });
    }
}

async function fetchLocationName(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || "Current Location";
        document.getElementById('locDisplay').innerText = city;
    } catch (e) { logStatus("Could not resolve address name."); }
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    if (!city) return;
    logStatus(`Searching: ${city}`);
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        const data = await resp.json();
        if (data && data.length > 0) {
            currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
            refreshUI();
        } else { logStatus("Location not found."); }
    } catch (e) { logStatus("Network error during search."); }
}

function refreshUI() {
    updateCalendar();
    updateChart();
}

async function updateCalendar() {
    const month = document.getElementById('monthSelect').value;
    const year = document.getElementById('yearSelect').value;
    logStatus(`Fetching Calendar for ${month}/${year}`);
    try {
        // Rounding coordinates to 4 decimal places for API stability
        const lat = currentCoords.lat.toFixed(4);
        const lon = currentCoords.lon.toFixed(4);
        const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=2`;
        
        const res = await fetch(url);
        const result = await res.json();
        
        if (!result.data) throw new Error("No data returned");

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
                </tr>`;
        }).join('');
        
        const d = new Date();
        if (d.getMonth() + 1 == month && d.getFullYear() == year) {
            displayToday(result.data[d.getDate()-1].timings);
            document.getElementById('dateDisplay').innerText = d.toDateString();
        }
    } catch (e) { 
        console.error(e);
        logStatus("Calendar Sync Failed."); 
    }
}

function displayToday(t) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `<div class="prayer-box"><h3>${k}</h3><p>${t[k].split(' ')[0]}</p></div>`).join('');
}

async function updateChart() {
    const timespan = parseInt(document.getElementById('timespanSelect').value);
    logStatus(`Fetching ${timespan} months for graph...`);
    
    let combinedData = [];
    const lat = currentCoords.lat.toFixed(4);
    const lon = currentCoords.lon.toFixed(4);
    
    // Calculate start dates
    let startMonth = new Date().getMonth() + 1;
    let startYear = new Date().getFullYear();

    try {
        for (let i = 0; i < timespan; i++) {
            let m = ((startMonth + i - 1) % 12) + 1;
            let y = startYear + Math.floor((startMonth + i - 1) / 12);
            
            logStatus(`Loading ${m}/${y}...`);
            const url = `https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${lat}&longitude=${lon}&method=2`;
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.data) {
                combinedData = combinedData.concat(json.data);
            }
            
            // Artificial delay to prevent API rate limiting
            if (timespan > 1) await new Promise(resolve => setTimeout(resolve, 150));
        }

        if (combinedData.length === 0) throw new Error("No data fetched");
        
        logStatus("Processing graph visualization...");
        renderChart(combinedData);
    } catch (err) {
        console.error("Fetch Error:", err);
        logStatus("Graph data fetch error. Check connection.");
    }
}

function timeToDec(t) {
    if(!t) return 0;
    const cleanTime = t.split(' ')[0]; // Strip timezone strings
    const parts = cleanTime.split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
}

function renderChart(data) {
    const canvas = document.getElementById('prayerChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const annos = {};
    data.forEach((d, i) => {
        if (d.hijri.month.number === 9) {
            annos['ram' + i] = { 
                type: 'box', 
                xMin: i, 
                xMax: i + 1, 
                backgroundColor: 'rgba(251, 191, 36, 0.15)', 
                borderWidth: 0,
                drawTime: 'beforeDatasetsDraw'
            };
        }
        const eventKey = `${parseInt(d.hijri.day)}-${d.hijri.month.number}`;
        if (KEY_EVENTS[eventKey]) {
            annos['ev' + i] = {
                type: 'line', xMin: i, xMax: i, 
                borderColor: '#ef4444', borderWidth: 2,
                label: { 
                    content: KEY_EVENTS[eventKey], 
                    display: true, 
                    position: 'start', 
                    backgroundColor: '#ef4444', 
                    color: '#fff', 
                    font: {size: 10},
                    z: 10
                }
            };
        }
    });

    try {
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
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    annotation: { annotations: annos },
                    legend: { labels: { color: '#f8fafc' } }
                },
                scales: {
                    y: { 
                        ticks: { 
                            color: '#f8fafc', 
                            callback: v => Math.floor(v) + ":00" 
                        }, 
                        grid: { color: 'rgba(255,255,255,0.1)' } 
                    },
                    x: { 
                        ticks: { color: '#f8fafc', maxTicksLimit: 10 }, 
                        grid: { display: false } 
                    }
                }
            }
        });
        logStatus("Dashboard Updated.");
    } catch (err) {
        logStatus("Visualization Error.");
    }
}
