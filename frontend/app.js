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
    // Discovery Engine
    teleportInput: document.getElementById('discovery-input'),
    teleportBtn: document.getElementById('teleport-btn'),
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
        const data = await res.json();
        
        // Final Hardening: If health-check, update telemetry stats
        if (endpoint === '/health' && data) {
            if (data.lastSlot !== undefined && data.networkSlot !== undefined) {
                const desync = Math.max(0, data.networkSlot - data.lastSlot);
                const desyncEl = document.getElementById('network-desync');
                if (desyncEl) {
                    desyncEl.textContent = `${desync} SLOTS`;
                    desyncEl.className = desync < 50 ? 'cyan-text' : 'yellow-text';
                    if (desync > 500) desyncEl.className = 'red-text';
                }
            }
        }
        return data;
    } catch (e) {
        console.warn(`Fetch error on ${endpoint}:`, e);
        return null;
    }
}

// Periodic Telemetry Pulse
setInterval(() => fetchData('/health'), 5000);

// -----------------------------------------------------
// PANEL RENDERERS
// -----------------------------------------------------

async function renderUniversal() {
    // 1. Discovery Phase
    const progMeta = await fetchData(`/v1/programs/${activeProgram}`);
    if (!progMeta || !progMeta.indexedInstructions || progMeta.indexedInstructions.length === 0) {
        UI.universalTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted)">Waiting for IDL discovery on ${activeProgram}...</td></tr>`;
        return;
    }

    const instructions = progMeta.indexedInstructions;
    if (!activeInstruction) activeInstruction = instructions[0].replace('ix_', '');

    if (!universalControlsMounted) {
        // Structural Purge: Ensure only one dynamic selector appears
        const oldSelect = document.getElementById('univ-ix-select');
        if (oldSelect) oldSelect.parentElement.removeChild(oldSelect);

        // Inject Dropdown
        const header = document.querySelector('#panel-universal .panel-header');
        const selectHTML = `<select id="univ-ix-select" class="tech-select">
            ${instructions.map(ix => {
                const cleanName = ix.replace('ix_', '').replace(/"/g, '');
                return `<option value="${cleanName}" ${cleanName === activeInstruction ? 'selected' : ''}>${cleanName.toUpperCase()}</option>`;
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

async function renderBags() {
    const launchData = await fetchData('/v1/indexed/dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN/create_virtual_pool_metadata?limit=10');
    const feeData = await fetchData('/v1/indexed/FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK/claim_user?limit=10');

    const launchEl = document.getElementById('bags-launches');
    const feeEl = document.getElementById('bags-fees');

    if (launchData && launchData.data && launchData.data.length > 0) {
        launchEl.innerHTML = launchData.data.map(r => `
            <div class="bag-card">
                <div class="card-title">${r.name || 'ANONYMOUS_LAUNCH'}</div>
                <div class="card-meta">
                    SIGNATURE: ${truncate(r.signature)}<br>
                    SYMBOL: ${r.symbol || '???'} | CREATOR: ${truncate(r.creator || 'UNKNOWN')}
                </div>
            </div>
        `).join('');
    } else {
        launchEl.innerHTML = `<div class="loading-manifest">AWAITING_NEW_GEMS...</div>`;
    }

    if (feeData && feeData.data && feeData.data.length > 0) {
        feeEl.innerHTML = feeData.data.map(r => `
            <div class="bag-card">
                <div class="card-title">FEE_REVENUE_CLAIM</div>
                <div class="card-meta">
                    SIGNATURE: ${truncate(r.signature)}<br>
                    VAULT: ${truncate(r.platform_vault || r.fee_share_authority || '...')}<br>
                    STATUS: <span class="cyan-text">DISTRIBUTED</span>
                </div>
            </div>
        `).join('');
    } else {
        feeEl.innerHTML = `<div class="loading-manifest">SYNCING_PROTOCOL_REVENUE...</div>`;
    }
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
        if (tab === 'bags') renderBags();
    };

    triggerFetch(); // Run immediately
    pollInterval = setInterval(triggerFetch, POLL_RATE);
}

// -----------------------------------------------------
// DISCOVERY ENGINE CONTROL
// -----------------------------------------------------
// --- INTEGRATION HUB: TECHNICAL DOCUMENTATION MANIFEST ---
const docsData = {
    core: {
        title: "AETHER_CORE // UNIVERSAL_INDEXING",
        content: `Aether's primary engine. Performs high-speed Anchor IDL discovery and automated SQL schema generation.
- 🚀 **Sub-second indexing** from Solana live-stream.
- 🛡️ **Vacuum-hardened SQL** preventing reserved keyword collisions.
- 📊 **Dual-Engine Persistence**: SQLite for Registry + DuckDB for Analytics.`,
        code: `const aether = new AetherSDK();
await aether.teleport('RAYSHARP...').on('ix', (tx) => {
    console.log('⚡ High-fidelity indexed event:', tx.name);
});`
    },
    agentic: {
        title: "AGENTIC_SHARD // COGNITIVE_NARRATIVES",
        content: `Translates cold on-chain bytes into semantic narratives for AI Agents.
- 🧠 **Context-Aware Processing**: Links cross-protocol interactions.
- 💬 **Natural Language Streams**: Ready-for-LLM event feeds.
- 🔗 **Memory Persistence**: Durable narrative history.`,
        code: `const agent = new AetherAgentic();
agent.observe('RAYDIUM_SWAP').on('narrative', (msg) => {
    // Result: "Trader swapped 50.2 SOL for 1M PEPE in block 410..."
    agent.remember(msg);
});`
    },
    zk: {
        title: "ZK_PROOFS // STATELESS_VERIFICATION",
        content: `Merkle-root anchored state proofs for trustless off-chain computation.
- 🔒 **Trustless Verification**: Audit protocol state without a full node.
- 📜 **Stateless Queries**: Instant ZK-backed data retrieval.
- 🛡️ **Fraud Integrity**: Cryptographic proof of indexing correctness.`,
        code: `const zk = new AetherZK();
const proof = await zk.proveState('USER_VAULT_BALANCE');
const isValid = await zk.verifyOnChain(proof);
console.log('Proof Integrity:', isValid);`
    },
    lending: {
        title: "LENDING_GUARD // LIQUIDATION_RADAR",
        content: `Real-time risk monitoring for lending and borrowing protocols.
- 🚨 **Liquidation Watch**: Identify at-risk positions sub-second.
- 🛡️ **Vault Integrity**: Cross-checks price oracles against on-chain reality.
- 📈 **Risk Analytics**: Protocol-wide health metrics.`,
        code: `const guard = new AetherLending('KAMINO_PUBKEY');
guard.on('at_risk_position', (user) => {
    console.warn('⚠️ Liquidation warning for:', user.pubkey);
});`
    },
    nft: {
        title: "NFT_STREAM // METADATA_AGGREGATION",
        content: `High-fidelity NFT metadata and ownership auditing.
- 🖼️ **Rich Metadata**: Sub-second indexing of mints and sales.
- 📜 **Provenance Audit**: Complete ownership history snapshots.
- 🛒 **Marketplace Agnostic**: Unified stream for MagicEden, Tensor, and more.`,
        code: `const nft = new AetherNFT();
nft.on('mint', (event) => {
    console.log('✨ New high-value mint detected:', event.uri);
});`
    },
    bags: {
        title: "BAGS_EXPLORER // PROTOCOL_INTELLIGENCE",
        content: `Real-time monitoring of the Bags.fm ecosystem and fee-sharing mechanics.
- 💎 **Launch Tracker**: Identify new tokens at the moment of creation.
- 💰 **Fee Transparency**: Real-time audit of protocol revenue and creator yields.
- ⚡ **Universal Compatibility**: Leveraging Aether's dynamic decoding for all Bag programs.`,
        code: `const bags = new AetherBags();
bags.monitor('FEE2tBh...').on('dividend', (data) => {
    console.log('💸 New fee distribution detected:', data.amount);
});`
    }
};

function showModuleDocs(moduleId) {
    const doc = docsData[moduleId];
    const viewport = document.getElementById('docs-viewport');
    
    // Update active tab styling
    document.querySelectorAll('.docs-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    viewport.innerHTML = `
        <div class="docs-reveal active">
            <h4 class="cyan-text">${doc.title}</h4>
            <div class="docs-description">${doc.content}</div>
            <div class="code-header">SDK_BLUEPRINT_v4</div>
            <pre class="code-block">${doc.code}</pre>
        </div>
    `;
}

// Set initial docs state
window.addEventListener('DOMContentLoaded', () => {
    showModuleDocs('core');
});

if (UI.teleportBtn) {
    UI.teleportBtn.addEventListener('click', async () => {
        const programId = UI.teleportInput.value.trim();
        if (!programId || programId.length < 32) {
            alert("LIBRARIAN: Invalid Program ID signature detected.");
            return;
        }

        UI.teleportBtn.textContent = 'TELEPORTING...';
        UI.teleportBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/v1/universal/index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ programId })
            });
            
            const result = await res.json();
            if (res.ok) {
                console.log(`[Librarian] Teleport Success: ${result.name}`);
                activeProgram = programId;
                universalControlsMounted = false; // Reset to re-discover IDL
                initDataFetch('universal');
            } else {
                alert(`LIBRARIAN: Discovery Failure - ${result.error}`);
            }
        } catch (e) {
            console.error("[Librarian] Teleport Error:", e);
        } finally {
            UI.teleportBtn.textContent = 'TELEPORT_';
            UI.teleportBtn.disabled = false;
        }
    });
}

// Initial Boot
initDataFetch(activeTab);
