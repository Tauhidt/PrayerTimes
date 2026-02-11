document.addEventListener('DOMContentLoaded', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
});

async function success(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    document.getElementById('location-name').innerText = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
    document.getElementById('current-date').innerText = date.toDateString();

    try {
        // Fetch monthly data from Aladhan API
        const response = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=2`);
        const result = await response.json();
        const monthData = result.data;

        displayToday(monthData[date.getDate() - 1].timings);
        displayTable(monthData);
        renderChart(monthData);
    } catch (err) {
        console.error("Error fetching prayer times:", err);
    }
}

function error() {
    document.getElementById('location-name').innerText = "Location access denied. Showing default (London).";
    // Fallback logic could go here
}

function displayToday(timings) {
    const container = document.getElementById('today-prayers');
    const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    container.innerHTML = prayers.map(p => `
        <div class="prayer-box">
            <h3>${p}</h3>
            <p>${timings[p].split(' ')[0]}</p>
        </div>
    `).join('');
}

function displayTable(data) {
    const tableBody = document.getElementById('monthly-table-body');
    tableBody.innerHTML = data.map(day => `
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

function timeToDecimal(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
}

function renderChart(data) {
    const ctx = document.getElementById('prayerChart').getContext('2d');
    
    const labels = data.map(d => d.date.gregorian.day);
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const colors = ['#fbbf24', '#10b981', '#f97316', '#8b5cf6', '#6366f1'];

    const datasets = prayers.map((prayer, index) => ({
        label: prayer,
        data: data.map(d => timeToDecimal(d.timings[prayer].split(' ')[0])),
        borderColor: colors[index],
        backgroundColor: colors[index],
        tension: 0.3,
        fill: false
    }));

    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: 'Time (24h Format)', color: '#fff' },
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    title: { display: true, text: 'Day of Month', color: '#fff' },
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}
