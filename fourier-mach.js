const maxTime = 10.0; 
const dt = 0.025;      

let currentTime = 0;
let animationFrameId = null;
let windingFreq = 1.0;

let channels = [
    { hz: 1.0, amp: 1.0 },
    { hz: 2.5, amp: 0.8 }
];

let complexPoints = [];
let sumReal = 0, sumImag = 0, count = 0;
let timeChart, complexChart, centerTrackingChart;

const container = document.getElementById('frequencyContainer');
const windingInput = document.getElementById('windingFreqInput');
const windingVal = document.getElementById('windingFreqVal');
const startBtn = document.getElementById('startBtn');

window.onload = () => {
    initCharts();
    renderChannelUI();
    updateFourierSpectrum();
    resetSimulation();
};

function renderChannelUI() {
    container.innerHTML = '';
    channels.forEach((ch, idx) => {
        const card = document.createElement('div');
        card.className = 'freq-card';
        card.innerHTML = `
            <label>주파수 ${idx+1}:</label>
            <input type="number" value="${ch.hz}" min="0.1" max="5.0" step="0.1" class="hz-input" data-idx="${idx}"> Hz
            <label style="margin-left:5px;">진폭:</label>
            <input type="number" value="${ch.amp}" min="0.0" max="2.0" step="0.1" class="amp-input" data-idx="${idx}">
            <button class="btn-red del-btn" data-idx="${idx}">X</button>
        `;
        container.appendChild(card);
    });
    bindUIEvents();
}

function bindUIEvents() {
    document.querySelectorAll('.hz-input').forEach(input => {
        input.addEventListener('change', (e) => {
            channels[e.target.dataset.idx].hz = parseFloat(e.target.value) || 0;
            updateFourierSpectrum(); resetSimulation();
        });
    });
    document.querySelectorAll('.amp-input').forEach(input => {
        input.addEventListener('change', (e) => {
            channels[e.target.dataset.idx].amp = parseFloat(e.target.value) || 0;
            updateFourierSpectrum(); resetSimulation();
        });
    });
    document.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            channels.splice(e.target.dataset.idx, 1);
            renderChannelUI(); updateFourierSpectrum(); resetSimulation();
        });
    });
}

document.getElementById('addFreqBtn').addEventListener('click', () => {
    channels.push({ hz: 2.0, amp: 0.5 });
    renderChannelUI(); updateFourierSpectrum(); resetSimulation();
});

document.getElementById('presetSquareBtn').addEventListener('click', () => {
    channels = [
        { hz: 1.0, amp: 1.0 },
        { hz: 3.0, amp: 1.0 / 3.0 },
        { hz: 5.0, amp: 1.0 / 5.0 }
    ];
    renderChannelUI(); updateFourierSpectrum(); resetSimulation();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    channels = [];
    renderChannelUI(); updateFourierSpectrum(); resetSimulation();
});

windingInput.addEventListener('input', (e) => {
    windingFreq = parseFloat(e.target.value);
    windingVal.innerText = windingFreq.toFixed(2);
    updateFourierSpectrum(); resetSimulation();
});
startBtn.addEventListener('click', startSimulation);

function signalFunction(t) {
    let sum = 0;
    channels.forEach(ch => {
        sum += ch.amp * Math.sin(2 * Math.PI * ch.hz * t);
    });
    return sum;
}

function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    timeChart = new Chart(document.getElementById('timeChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '합성 신호', data: [], borderColor: '#38bdf8', borderWidth: 2, pointRadius: 0, tension: 0.2 },
                { label: '현재 위치', data: [], borderColor: '#f43f5e', borderWidth: 1.5, borderDash: [4,4], pointRadius: 0 }
            ]
        },
        options: { scales: { x: { type: 'linear', min: 0, max: maxTime }, y: { min: -2.5, max: 2.5 } }, animation: false, plugins: { legend: { display: false } } }
    });

    complexChart = new Chart(document.getElementById('complexChart').getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                { label: '원형 파형', data: [], borderColor: '#4ade80', borderWidth: 1.2, showLine: true, pointRadius: 0, tension: 0.1 },
                { label: '현재 끝점', data: [], backgroundColor: '#f43f5e', pointRadius: 6 },
                { label: '실제 무게중심', data: [], backgroundColor: '#fbbf24', borderColor: '#ffffff', borderWidth: 1.5, pointRadius: 8 },
                { label: '중심 벡터선', data: [], borderColor: 'rgba(251, 191, 36, 0.4)', borderWidth: 1.5, showLine: true, pointRadius: 0 }
            ]
        },
        options: { scales: { x: { min: -2.5, max: 2.5 }, y: { min: -2.5, max: 2.5 } }, aspectRatio: 1, animation: false, plugins: { legend: { display: false } } }
    });

    centerTrackingChart = new Chart(document.getElementById('centerTrackingChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '전체 스펙트럼', data: [], borderColor: '#475569', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '탐색 흔적', data: [], borderColor: '#61dafb', backgroundColor: 'rgba(97, 218, 251, 0.15)', fill: true, pointRadius: 0 },
                { label: '현재 위치', data: [], backgroundColor: '#ffffff', pointRadius: 7 }
            ]
        },
        options: { scales: { x: { type: 'linear', min: 0, max: 5.0 }, y: { min: -0.05, max: 1.2 } }, animation: false, plugins: { legend: { display: false } } }
    });
}

function updateFourierSpectrum() {
    let fullSpectrum = [];
    let tracedSpectrum = [];
    
    for (let f = 0; f <= 5.0; f += 0.02) {
        let sumX = 0, sumY = 0, c = 0;
        for (let t = 0; t <= maxTime; t += 0.05) {
            let theta = -2 * Math.PI * f * t;
            let r = signalFunction(t);
            sumX += r * Math.cos(theta);
            sumY += r * Math.sin(theta);
            c++;
        }
        let magnitude = Math.sqrt((sumX/c)**2 + (sumY/c)**2);
        fullSpectrum.push({x: f, y: magnitude});
        if (f <= windingFreq) tracedSpectrum.push({x: f, y: magnitude});
    }
    
    centerTrackingChart.data.datasets[0].data = fullSpectrum;
    centerTrackingChart.data.datasets[1].data = tracedSpectrum;
    
    let currentY = 0;
    if(fullSpectrum.length > 0) {
        let closest = fullSpectrum.reduce((prev, curr) => Math.abs(curr.x - windingFreq) < Math.abs(prev.x - windingFreq) ? curr : prev);
        currentY = closest.y;
    }
    centerTrackingChart.data.datasets[2].data = [{x: windingFreq, y: currentY}];
    centerTrackingChart.update();
}

function resetSimulation() {
    cancelAnimationFrame(animationFrameId);
    currentTime = 0; complexPoints = []; sumReal = 0; sumImag = 0; count = 0;

    let t_arr = [];
    for(let t=0; t<=maxTime; t+=0.02) t_arr.push({x: t, y: signalFunction(t)});
    timeChart.data.datasets[0].data = t_arr;
    timeChart.data.datasets[1].data = [];
    
    for(let i=0; i<4; i++) complexChart.data.datasets[i].data = [];
    timeChart.update(); complexChart.update();
}

function startSimulation() {
    resetSimulation();
    animate();
}

function animate() {
    if (currentTime > maxTime) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    let radius = signalFunction(currentTime); 
    let theta = -2 * Math.PI * windingFreq * currentTime;
    let x = radius * Math.cos(theta);
    let y = radius * Math.sin(theta);

    sumReal += x; sumImag += y; count++;
    let centerReal = sumReal / count;
    let centerImag = sumImag / count;

    complexPoints.push({x: x, y: y});

    timeChart.data.datasets[1].data = [{x: currentTime, y: -2.5}, {x: currentTime, y: 2.5}];
    complexChart.data.datasets[0].data = complexPoints;
    complexChart.data.datasets[1].data = [{x: x, y: y}];
    complexChart.data.datasets[2].data = [{x: centerReal, y: centerImag}];
    complexChart.data.datasets[3].data = [{x: 0, y: 0}, {x: centerReal, y: centerImag}];

    timeChart.update('none');
    complexChart.update('none');

    currentTime += dt;
    animationFrameId = requestAnimationFrame(animate);
}
