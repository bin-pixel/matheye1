'use strict';

const maxTime = 10.0; 
const dt = 0.025;      

let currentTime = 0;
let animationFrameId = null;
let windingFreq = 1.0;
let simSpeed = 1.0;

// 각 채널 데이터 구조에 독립 노출 여부인 visible 플래그 적용
let channels = [
    { hz: 1.0, amp: 1.0, phase: 0, visible: true },
    { hz: 2.5, amp: 0.8, phase: 90, visible: false }
];

let complexPoints = [];
let sumReal = 0, sumImag = 0, count = 0;
let timeChart, complexChart, centerTrackingChart;

// DOM 메모리 캐싱 가속화
const container = document.getElementById('frequencyContainer');
const windingInput = document.getElementById('windingFreqInput');
const windingVal = document.getElementById('windingFreqVal');
const speedInput = document.getElementById('speedInput');
const startBtn = document.getElementById('startBtn');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mainContent = document.getElementById('mainContent');

// 앱 초기 오케스트레이션
initCharts();
renderChannelUI();
updateFourierSpectrum();
resetSimulation();
updateFormulaUI();

function renderChannelUI() {
    container.innerHTML = '';
    channels.forEach((ch, idx) => {
        const card = document.createElement('div');
        card.className = 'freq-card';
        // 헤더 영역 내부에 개별 파형 시각화 토글 체크박스(.vis-check) 통합 구현
        card.innerHTML = `
            <div class="freq-card-header">
                <span style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" ${ch.visible ? 'checked' : ''} class="vis-check" data-idx="${idx}" id="vis_${idx}">
                    <label style="width:auto; cursor:pointer;" for="vis_${idx}">채널 ${idx+1} 성분</label>
                </span>
                <button class="btn-red del-btn" data-idx="${idx}">삭제 (X)</button>
            </div>
            <div class="freq-row">
                <label>주파수:</label>
                <input type="range" min="0.1" max="5.0" step="0.1" value="${ch.hz}" class="hz-range" data-idx="${idx}">
                <span class="val-disp">${ch.hz.toFixed(1)} Hz</span>
            </div>
            <div class="freq-row">
                <label>진폭:</label>
                <input type="range" min="0.0" max="2.0" step="0.1" value="${ch.amp}" class="amp-range" data-idx="${idx}">
                <span class="val-disp">${ch.amp.toFixed(1)}</span>
            </div>
            <div class="freq-row">
                <label>위상:</label>
                <input type="range" min="0" max="360" step="15" value="${ch.phase}" class="phase-range" data-idx="${idx}">
                <span class="val-disp">${ch.phase}°</span>
            </div>
        `;
        container.appendChild(card);
    });
    bindUIEvents();
}

function bindUIEvents() {
    // 그래프 표시 온오프 토글 이벤트 감지 바인딩
    document.querySelectorAll('.vis-check').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const idx = e.target.dataset.idx;
            channels[idx].visible = e.target.checked;
            resetSimulation(); 
            updateFormulaUI();
        });
    });

    document.querySelectorAll('.hz-range').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.idx;
            channels[idx].hz = parseFloat(e.target.value) || 0.1;
            e.target.nextElementSibling.innerText = `${channels[idx].hz.toFixed(1)} Hz`;
            onDataChange();
        });
    });

    document.querySelectorAll('.amp-range').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.idx;
            channels[idx].amp = parseFloat(e.target.value) || 0;
            e.target.nextElementSibling.innerText = channels[idx].amp.toFixed(1);
            onDataChange();
        });
    });

    document.querySelectorAll('.phase-range').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.idx;
            channels[idx].phase = parseInt(e.target.value) || 0;
            e.target.nextElementSibling.innerText = `${channels[idx].phase}°`;
            onDataChange();
        });
    });

    document.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            channels.splice(e.target.dataset.idx, 1);
            renderChannelUI();
            onDataChange();
        });
    });
}

function onDataChange() {
    updateFourierSpectrum(); 
    resetSimulation(); 
    updateFormulaUI();
}

// 프리셋 처리 및 제어단 리스너 등록
document.getElementById('addFreqBtn').addEventListener('click', () => {
    channels.push({ hz: 2.0, amp: 0.5, phase: 0, visible: true });
    renderChannelUI(); onDataChange();
});
document.getElementById('clearBtn').addEventListener('click', () => {
    channels = [];
    renderChannelUI(); onDataChange();
});

document.getElementById('presetSquare').addEventListener('click', () => {
    channels = [
        { hz: 1.0, amp: 1.2, phase: 0, visible: true },
        { hz: 3.0, amp: 0.4, phase: 0, visible: false },
        { hz: 5.0, amp: 0.24, phase: 0, visible: false }
    ];
    renderChannelUI(); onDataChange();
});
document.getElementById('presetSawtooth').addEventListener('click', () => {
    channels = [
        { hz: 1.0, amp: 1.0, phase: 0, visible: true },
        { hz: 2.0, amp: 0.5, phase: 0, visible: false },
        { hz: 3.0, amp: 0.33, phase: 0, visible: false },
        { hz: 4.0, amp: 0.25, phase: 0, visible: false }
    ];
    renderChannelUI(); onDataChange();
});
document.getElementById('presetPhaseDiff').addEventListener('click', () => {
    channels = [
        { hz: 1.5, amp: 1.0, phase: 0, visible: true },
        { hz: 1.5, amp: 1.0, phase: 180, visible: true }
    ];
    renderChannelUI(); onDataChange();
});

windingInput.addEventListener('input', (e) => {
    windingFreq = parseFloat(e.target.value);
    windingVal.innerText = windingFreq.toFixed(2);
    document.getElementById('formula-curr-wind').innerText = windingFreq.toFixed(2);
    onDataChange();
});
speedInput.addEventListener('input', (e) => { simSpeed = parseFloat(e.target.value); });
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    mainContent.classList.toggle('expanded');
});
startBtn.addEventListener('click', startSimulation);

function singleChannelFunction(ch, t) {
    const radPhase = (ch.phase * Math.PI) / 180;
    return ch.amp * Math.sin(2 * Math.PI * ch.hz * t + radPhase);
}

function signalFunction(t) {
    let sum = 0;
    const len = channels.length;
    for(let i=0; i<len; i++) { sum += singleChannelFunction(channels[i], t); }
    return sum;
}

function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    timeChart = new Chart(document.getElementById('timeChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '최종 합성 신호', data: [], borderColor: '#38bdf8', borderWidth: 2.5, pointRadius: 0, tension: 0.1 },
                { label: '채널 1 성분', data: [], borderColor: 'rgba(234, 179, 8, 0.6)', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '채널 2 성분', data: [], borderColor: 'rgba(168, 85, 247, 0.6)', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '채널 3 성분', data: [], borderColor: 'rgba(236, 72, 153, 0.6)', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '채널 4 성분', data: [], borderColor: 'rgba(20, 184, 166, 0.6)', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '현재 스캔 바', data: [], borderColor: '#f43f5e', borderWidth: 1.5, borderDash: [4,4], pointRadius: 0 }
            ]
        },
        options: { 
            scales: { x: { type: 'linear', min: 0, max: maxTime }, y: { min: -3.0, max: 3.0 } }, 
            animation: false, 
            plugins: { legend: { display: true, labels: { boxWidth: 12 } } } 
        }
    });

    complexChart = new Chart(document.getElementById('complexChart').getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                { label: '원형 파형 기하 궤적', data: [], borderColor: '#4ade80', borderWidth: 1.2, showLine: true, pointRadius: 0, tension: 0.1 },
                { label: '현재 끝점 위치', data: [], backgroundColor: '#f43f5e', pointRadius: 6 },
                { label: '무게중심점', data: [], backgroundColor: '#fbbf24', borderColor: '#ffffff', borderWidth: 1.5, pointRadius: 8 },
                { label: '중심 벡터선', data: [], borderColor: 'rgba(251, 191, 36, 0.4)', borderWidth: 1.5, showLine: true, pointRadius: 0 }
            ]
        },
        options: { scales: { x: { min: -3.0, max: 3.0 }, y: { min: -3.0, max: 3.0 } }, aspectRatio: 1, animation: false, plugins: { legend: { display: false } } }
    });

    centerTrackingChart = new Chart(document.getElementById('centerTrackingChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '전체 푸리에 스펙트럼', data: [], borderColor: '#475569', borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0 },
                { label: '탐색 흔적 누적', data: [], borderColor: '#61dafb', backgroundColor: 'rgba(97, 218, 251, 0.15)', fill: true, pointRadius: 0 },
                { label: '현재 스캔 주파수', data: [], backgroundColor: '#ffffff', borderColor: '#61dafb', borderWidth: 2, pointRadius: 7 }
            ]
        },
        options: { scales: { x: { type: 'linear', min: 0, max: 5.0 }, y: { min: -0.05, max: 1.5 } }, animation: false, plugins: { legend: { display: false } } }
    });
}

function updateFourierSpectrum() {
    const fullSpectrum = [];
    const tracedSpectrum = [];
    for (let f = 0; f <= 5.0; f += 0.02) {
        let sumX = 0, sumY = 0, c = 0;
        for (let t = 0; t <= maxTime; t += 0.05) {
            const theta = -2 * Math.PI * f * t;
            const r = signalFunction(t);
            sumX += r * Math.cos(theta);
            sumY += r * Math.sin(theta);
            c++;
        }
        const magnitude = Math.sqrt((sumX/c)**2 + (sumY/c)**2);
        fullSpectrum.push({x: f, y: magnitude});
        if (f <= windingFreq) tracedSpectrum.push({x: f, y: magnitude});
    }
    centerTrackingChart.data.datasets[0].data = fullSpectrum;
    centerTrackingChart.data.datasets[1].data = tracedSpectrum;
    
    let currentY = 0;
    if(fullSpectrum.length > 0) {
        const closest = fullSpectrum.reduce((prev, curr) => Math.abs(curr.x - windingFreq) < Math.abs(prev.x - windingFreq) ? curr : prev);
        currentY = closest.y;
    }
    centerTrackingChart.data.datasets[2].data = [{x: windingFreq, y: currentY}];
    centerTrackingChart.update();
}

function resetSimulation() {
    cancelAnimationFrame(animationFrameId);
    currentTime = 0; complexPoints = []; sumReal = 0; sumImag = 0; count = 0;

    const t_arr = [];
    for(let t=0; t<=maxTime; t+=0.02) t_arr.push({x: t, y: signalFunction(t)});
    timeChart.data.datasets[0].data = t_arr;
    
    // 유저가 채널 성분 체크박스(visible)를 켠 대상선만 연산 루프에 할당하여 성능 낭비 배제
    for (let i = 1; i <= 4; i++) {
        const ch = channels[i-1];
        if (ch && ch.visible) {
            const ch_arr = [];
            for(let t=0; t<=maxTime; t+=0.02) {
                ch_arr.push({x: t, y: singleChannelFunction(ch, t)});
            }
            timeChart.data.datasets[i].data = ch_arr;
            timeChart.setDatasetVisibility(i, true);
        } else {
            timeChart.data.datasets[i].data = [];
            timeChart.setDatasetVisibility(i, false);
        }
    }
    
    timeChart.data.datasets[5].data = [];
    for(let i=0; i<4; i++) complexChart.data.datasets[i].data = [];
    
    timeChart.update(); 
    complexChart.update();
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

    const radius = signalFunction(currentTime); 
    const theta = -2 * Math.PI * windingFreq * currentTime;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    sumReal += x; sumImag += y; count++;
    const centerReal = sumReal / count;
    const centerImag = sumImag / count;

    complexPoints.push({x: x, y: y});

    timeChart.data.datasets[5].data = [{x: currentTime, y: -3.0}, {x: currentTime, y: 3.0}];
    complexChart.data.datasets[0].data = complexPoints;
    complexChart.data.datasets[1].data = [{x: x, y: y}];
    complexChart.data.datasets[2].data = [{x: centerReal, y: centerImag}];
    complexChart.data.datasets[3].data = [{x: 0, y: 0}, {x: centerReal, y: centerImag}];

    timeChart.update('none');
    complexChart.update('none');

    currentTime += (dt * simSpeed);
    animationFrameId = requestAnimationFrame(animate);
}

function updateFormulaUI() {
    const chBox = document.getElementById('formula-channels');
    if(channels.length === 0) chBox.innerText = "활성화된 성분 없음";
    else {
        chBox.innerHTML = channels.map((ch, idx) => {
            const stateText = ch.visible ? ' (차트 표시 중)' : ' (숨김)';
            return `ch${idx+1}: ${ch.amp.toFixed(1)}·sin(2π·${ch.hz.toFixed(1)}·t ${ch.phase >= 0 ? '+' : ''}${ch.phase}°)${stateText}\n`;
        }).join("");
    }

    const sigBox = document.getElementById('formula-signal');
    if(channels.length === 0) sigBox.innerText = "f(t) = 0";
    else {
        sigBox.innerText = "f(t) = " + channels.map((ch, idx) => `ch${idx+1}`).join(" + ");
    }

    const centerBox = document.getElementById('formula-center');
    centerBox.innerText = `F(${windingFreq.toFixed(2)}) = 1/T · ʃ [f(t) · e^(-i·2π·${windingFreq.toFixed(2)}·t)] dt`;
}
