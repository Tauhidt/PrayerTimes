let currentCoords = { lat: 21.4225, lon: 39.8262 }; // Default Mecca
let chartInstance = null;

const KEY_EVENTS = {
    "17-9": "Battle of Badr",
    "1-10": "Eid al-Fitr",
    "10-12": "Eid al-Adha"
};

window.onload = () => { setupSelectors(); updateCalendar(); updateChart(); };

function setupSelectors() {
    const mSelect = document.getElementById('monthSelect');
    const ySelect = document.getElementById('yearSelect');
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    months.forEach((m, i) => mSelect.innerHTML += `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`);
    for(let i = 2024; i <= 2027; i++) ySelect.innerHTML += `<option value="${i}" ${i === new Date().getFullYear() ? 'selected' : ''}>${i}</option>`;
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
    const data = await resp.json();
    if (data[0]) {
        currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
        updateCalendar(); updateChart();
    }
}

async function updateCalendar() {
    const month = document.getElementById('monthSelect').value;
    const year = document.getElementById('yearSelect').value;
    const res = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`);
    const data = await res.json();
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = data.data.map(day => {
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
    
    // Display today
    const d = new Date();
    if (d.getMonth()+1 == month) displayToday(data.data[d.getDate()-1].timings);
}

function displayToday(t) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `<div class="prayer-box"><h3>${k}</h3><p>${t[k].split(' ')[0]}</p></div>`).join('');
}

async function updateChart() {
    const monthsToFetch = parseInt(document.getElementById('timespanSelect').value);
    let allData = [];
    let startM = new Date().getMonth() + 1;
    let startY = new Date().getFullYear();

    for (let i = 0; i < monthsToFetch; i++) {
        let m = ((startM + i - 1) % 12) + 1;
        let y = startY + Math.floor((startM + i - 1) / 12);
        const res = await fetch(`https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`);
        const json = await res.json();
        allData = allData.concat(json.data);
    }
    renderChart(allData);
}

function timeToDec(t) {
    const [h, m] = t.split(' ')[0].split(':').map(Number);
    return h + (m / 60);
}

function renderChart(data) {
    const ctx = document.getElementById('prayerChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const annotations = [];
    data.forEach((d, i) => {
        // Highlight Ramadan
        if (d.hijri.month.number === 9) {
            annotations.push({
                type: 'box', xMin: i, xMax: i + 1, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderWidth: 0
            });
        }
        // Mark Special Days
        const eventKey = `${parseInt(d.hijri.day)}-${d.hijri.month.number}`;
        if (KEY_EVENTS[eventKey]) {
            annotations.push({
                type: 'line', xMin: i, xMax: i, borderColor: '#ef4444', borderWidth: 2,
                label: { content: KEY_EVENTS[eventKey], display: true, position: 'start', backgroundColor: '#ef4444', font: {size: 10} }
            });
        }
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.readable),
            datasets: [
                { label: 'Fajr', data: data.map(d => timeToDec(d.timings.Fajr)), borderColor: '#fbbf24', tension: 0.1 },
                { label: 'Dhuhr', data: data.map(d => timeToDec(d.timings.Dhuhr)), borderColor: '#10b981', tension: 0.1 },
                { label: 'Asr', data: data.map(d => timeToDec(d.timings.Asr)), borderColor: '#f97316', tension: 0.1 },
                { label: 'Maghrib', data: data.map(d => timeToDec(d.timings.Maghrib)), borderColor: '#8b5cf6', tension: 0.1 },
                { label: 'Isha', data: data.map(d => timeToDec(d.timings.Isha)), borderColor: '#6366f1', tension: 0.1 }
            ]
        },
        options: {
            responsive: true,
            elements: { point: { radius: data.length > 31 ? 0 : 2 } },
            plugins: {
                annotation: { annotations: annotations },
                legend: { labels: { color: '#fff' } }
            },
            scales: {
                y: { ticks: { color: '#fff' }, grid: { color: '#334155' } },
                x: { ticks: { color: '#fff', maxTicksLimit: 12 }, grid: { display: false } }
            }
        }
    });
}
