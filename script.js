let currentCoords = { lat: 51.5074, lon: -0.1278 }; // Default London
let chartInstance = null;

// Initialize App
window.onload = () => {
    setupSelectors();
    useCurrentLocation();
};

function setupSelectors() {
    const mSelect = document.getElementById('monthSelect');
    const ySelect = document.getElementById('yearSelect');
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentYear = new Date().getFullYear();

    months.forEach((m, i) => mSelect.innerHTML += `<option value="${i+1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`);
    for(let i = currentYear - 2; i <= currentYear + 2; i++) {
        ySelect.innerHTML += `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${i}</option>`;
    }
}

async function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            refreshData();
        }, () => refreshData());
    }
}

async function handleManualLocation() {
    const city = document.getElementById('cityInput').value;
    if (!city) return;
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        const data = await resp.json();
        if (data.length > 0) {
            currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            document.getElementById('locDisplay').innerText = data[0].display_name.split(',')[0];
            refreshData();
        } else { alert("Location not found"); }
    } catch (e) { console.error(e); }
}

async function refreshData() {
    updateCalendar();
    updateChart();
}

async function updateCalendar() {
    const month = document.getElementById('monthSelect').value;
    const year = document.getElementById('yearSelect').value;
    const res = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&method=2`);
    const data = await res.json();
    
    // Update Today Card (if viewing current month)
    const today = new Date();
    if (today.getMonth() + 1 == month && today.getFullYear() == year) {
        displayToday(data.data[today.getDate() - 1].timings);
    }

    // Populate Table
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = data.data.map(day => `
        <tr>
            <td>${day.date.readable}</td>
            <td>${day.timings.Fajr.split(' ')[0]}</td>
            <td>${day.timings.Sunrise.split(' ')[0]}</td>
            <td>${day.timings.Dhuhr.split(' ')[0]}</td>
            <td>${day.timings.Asr.split(' ')[0]}</td>
            <td>${day.timings.Maghrib.split(' ')[0]}</td>
            <td>${day.timings.Isha.split(' ')[0]}</td>
        </tr>
    `).join('');
}

function displayToday(timings) {
    const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    document.getElementById('todayGrid').innerHTML = keys.map(k => `
        <div class="prayer-box"><h3>${k}</h3><p>${timings[k].split(' ')[0]}</p></div>
    `).join('');
}

async function updateChart() {
    const monthsToFetch = parseInt(document.getElementById('timespanSelect').value);
    const startMonth = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    
    let allData = [];
    // Loop to fetch multiple months if necessary (1, 3, or 12)
    for (let i = 0; i < monthsToFetch; i++) {
        let m = ((startMonth + i - 1) % 12) + 1;
        let y = year + Math.floor((startMonth + i - 1) / 12);
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

    const labels = data.map(d => d.date.readable);
    const datasets = [
        { label: 'Fajr', data: data.map(d => timeToDec(d.timings.Fajr)), borderColor: '#fbbf24' },
        { label: 'Maghrib', data: data.map(d => timeToDec(d.timings.Maghrib)), borderColor: '#8b5cf6' },
        { label: 'Isha', data: data.map(d => timeToDec(d.timings.Isha)), borderColor: '#6366f1' }
    ];

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            elements: { point: { radius: data.length > 31 ? 0 : 3 } },
            scales: {
                y: { ticks: { callback: v => Math.floor(v) + ":00" }, grid: { color: '#334155' } },
                x: { ticks: { maxTicksLimit: 10 }, grid: { display: false } }
            },
            plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }
        }
    });
}
