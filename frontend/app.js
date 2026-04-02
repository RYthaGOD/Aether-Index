// Aether Index: Dashboard Logic
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:4000/api' 
    : '/api'; // Relative for Railway

const UI = {
    tabs: document.querySelectorAll('.nav-links li'),
    panels: document.querySelectorAll('.panel'),
    clock: document.getElementById('sys-time'),
    
    // Panel Bodies
    universalTbody: document.getElementById('universal-data'),
    agenticFeed: document.getElementById('agentic-data'),
    lendingTbody: document.getElementById('lending-data'),
    zkTbody: document.getElementById('zk-data'),
};

let activeTab = 'universal';
let pollInterval;
const POLL_RATE = 3000; // 3 seconds

// Setup system clock
setInterval(() => {
    const now = new Date();
    UI.clock.textContent = now.toISOString().split('T')[1].replace('Z', '');
}, 100);

// Tab Switching
UI.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        if (target === activeTab) return;

        // Visual update
        UI.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        UI.panels.forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${target}`).classList.add('active');
        
        activeTab = target;
        initDataFetch(activeTab);
    });
});

// Dynamic Universal Control State
let activeProgram = 'Unknown'; 
let activeInstruction = '';
let universalControlsMounted = false;

// Formatters
const truncate = (str, len = 8) => str ? str.slice(0, len) + '...' : '-';
const formatNum = (num) => parseFloat(num).toLocaleString(undefined, { maximumFractionDigits: 4 });

// Core Fetcher
async function fetchData(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (e) {
        console.warn(`Fetch error on ${endpoint}:`, e);
        return null; // Silent fail for UI demo
    }
}

// -----------------------------------------------------
// PANEL RENDERERS
// -----------------------------------------------------

async function renderUniversal() {
    // 1. Discovery Phase
    if (!universalControlsMounted) {
        // We will default to Unknown IDL assuming the demo setup uses it.
        // In a fully dynamic setup we could ping /api/v1/programs to list all.
        const progMeta = await fetchData(`/v1/programs/${activeProgram}`);
        const instructions = progMeta?.indexedInstructions || ['ix_placeholder'];
        
        activeInstruction = instructions[0].replace('ix_', '');
        
        // Inject Dropdown
        const header = document.querySelector('#panel-universal .panel-header');
        const selectHTML = `<select id="univ-ix-select" class="tech-select">
            ${instructions.map(ix => {
                const cleanName = ix.replace('ix_', '');
                return `<option value="${cleanName}">${cleanName.toUpperCase()}</option>`;
            }).join('')}</select>`;
            
        header.insertAdjacentHTML('afterbegin', selectHTML);
        document.getElementById('univ-ix-select').addEventListener('change', (e) => {
            activeInstruction = e.target.value;
            renderUniversal(); // Re-render immediately
        });
        universalControlsMounted = true;
    }

    if (!activeInstruction || activeInstruction === 'placeholder') return;

    // 2. Data Fetch
    const data = await fetchData(`/v1/indexed/${activeProgram}/${activeInstruction}?limit=10`);
    if (!data || !data.data || data.data.length === 0) {
        UI.universalTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted)">Waiting for Helius Webhook data...</td></tr>`;
        return;
    }

    // 3. Dynamic Column Headers
    const rows = data.data;
    const firstRow = rows[0];
    const columns = Object.keys(firstRow).filter(k => k !== 'signature' && k !== 'slot');
    
    const tableHeader = document.querySelector('#panel-universal thead tr');
    tableHeader.innerHTML = `
        <th>SIGNATURE</th>
        <th>SLOT</th>
        ${columns.map(c => `<th>${c.toUpperCase()}</th>`).join('')}
    `;

    // 4. Render Rows
    UI.universalTbody.innerHTML = rows.map(r => `
        <tr>
            <td style="color:var(--accent-cyan)">${truncate(r.signature)}</td>
            <td>${r.slot}</td>
            ${columns.map(c => `<td>${typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]}</td>`).join('')}
        </tr>
    `).join('');
}

async function renderAgentic() {
    const data = await fetchData('/agentic/narratives?limit=15');
    if (!data || !data.data) {
        UI.agenticFeed.innerHTML = `<div class="feed-item"><div class="feed-time">SYSTEM</div><div class="feed-text">Awaiting cognitive input...</div></div>`;
        return;
    }

    UI.agenticFeed.innerHTML = data.data.map(r => `
        <div class="feed-item">
            <div class="feed-time">${new Date(r.timestamp).toISOString().replace('T', ' ')}</div>
            <div class="feed-text">> ${r.narrative}</div>
        </div>
    `).join('');
}

async function renderLending() {
    const data = await fetchData('/lending/liquidations?limit=10');
    if (!data || !data.data) return;

    UI.lendingTbody.innerHTML = data.data.map(r => `
        <tr>
            <td style="color:var(--accent-cyan)">${truncate(r.signature)}</td>
            <td style="color:var(--accent-yellow)">${truncate(r.protocol)}</td>
            <td style="font-weight:bold; color:var(--accent-red)">${formatNum(r.repaid_amount)}</td>
        </tr>
    `).join('');
}

async function renderZK() {
    const data = await fetchData('/zk/proofs?limit=10');
    if (!data || !data.data) return;

    UI.zkTbody.innerHTML = data.data.map(r => `
        <tr>
            <td style="color:var(--accent-cyan)">${truncate(r.signature)}</td>
            <td style="color:var(--text-muted)">${truncate(r.state_root, 12)}</td>
            <td><span class="badge ${r.verification_status === 'VERIFIED' ? 'cyan-badge' : 'yellow-badge'}">${r.verification_status}</span></td>
        </tr>
    `).join('');
}

// -----------------------------------------------------
// POLLING ORCHESTRATOR
// -----------------------------------------------------
function initDataFetch(tab) {
    if (pollInterval) clearInterval(pollInterval);
    
    const triggerFetch = () => {
        if (tab === 'universal') renderUniversal();
        if (tab === 'agentic') renderAgentic();
        if (tab === 'lending') renderLending();
        if (tab === 'zk') renderZK();
    };

    triggerFetch(); // Run immediately
    pollInterval = setInterval(triggerFetch, POLL_RATE);
}

// Initial Boot
initDataFetch(activeTab);
