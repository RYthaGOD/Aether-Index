/**
 * AetherIndex | Arbitrage Command Center
 * Industrial Futurist Controller
 */

class Dashboard {
    constructor() {
        this.socket = null;
        this.elements = {
            status: document.getElementById('connection-status'),
            slot: document.getElementById('last-slot'),
            raydium: document.getElementById('price-raydium'),
            orca: document.getElementById('price-orca'),
            meteora: document.getElementById('price-meteora'),
            alert: document.getElementById('arbitrage-alert'),
            logs: document.getElementById('log-container')
        };
        
        this.prices = { raydium: 0, orca: 0, meteora: 0 };
        this.init();
    }

    init() {
        this.connect();
        this.startRadarAnimation();
    }

    connect() {
        this.elements.status.textContent = 'LINKING TO SOVEREIGN...';
        this.elements.status.classList.add('connecting');
        console.log('[Dashboard] Attempting to link with AetherIndex Gateway at ws://localhost:4000/graphql');

        // subscriptions-transport-ws uses 'graphql-ws' sub-protocol
        this.ws = new WebSocket('ws://localhost:4000/graphql', 'graphql-ws');
        
        this.ws.onopen = () => {
            console.log('[Dashboard] WebSocket Handshake Successful');
            this.elements.status.textContent = 'LINK ACTIVE';
            this.elements.status.classList.remove('connecting');
            this.elements.status.classList.add('active');

            // Send GQL_CONNECTION_INIT (standard for subscriptions-transport-ws)
            this.ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));

            // Send Subscription for Price Drift
            this.ws.send(JSON.stringify({
                type: 'start',
                id: '1',
                payload: {
                    query: `subscription { priceDrift { raydium orca meteora slot timestamp } }`
                }
            }));

            // Send Subscription for Live Swap Feed
            this.ws.send(JSON.stringify({
                type: 'start',
                id: '2',
                payload: {
                    query: `subscription { newSwap { signature dex tokenIn tokenOut amountIn amountOut priceUsd maker } }`
                }
            }));
            
            console.log('[Dashboard] Subscriptions (Drift & Swaps) Sent');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'data' && data.payload.data) {
                if (data.payload.data.priceDrift) {
                    this.updateUI(data.payload.data.priceDrift);
                }
                if (data.payload.data.newSwap) {
                    this.addSwapLog(data.payload.data.newSwap);
                }
            } else if (data.type === 'error') {
                console.error('[Dashboard] GQL Error:', data.payload);
            }
        };

        this.ws.onerror = (err) => {
            console.error('[Dashboard] WebSocket Security/Link Error:', err);
            this.elements.status.textContent = 'LINK ERROR';
            this.elements.status.classList.add('error');
        };

        this.ws.onclose = (event) => {
            console.warn('[Dashboard] Connection Closed:', event.code, event.reason);
            this.elements.status.textContent = 'CONNECTION LOST';
            setTimeout(() => this.connect(), 2000);
        };
    }

    async pollData() {
        // No longer needed, using WebSocket Subscriptions
    }

    updateUI(data) {
        const changed = data.raydium !== this.prices.raydium || 
                        data.orca !== this.prices.orca || 
                        data.meteora !== this.prices.meteora;

        this.prices = data;
        
        this.elements.raydium.textContent = `$${data.raydium.toFixed(4)}`;
        this.elements.orca.textContent = `$${data.orca.toFixed(4)}`;
        this.elements.meteora.textContent = `$${data.meteora.toFixed(4)}`;
        this.elements.slot.textContent = data.slot || '---';

        if (changed) {
            this.pulseElements([this.elements.raydium, this.elements.orca, this.elements.meteora]);
        }

        this.detectArbitrage();
    }

    pulseElements(els) {
        els.forEach(el => {
            el.classList.add('pulse');
            setTimeout(() => el.classList.remove('pulse'), 300);
        });
    }

    detectArbitrage() {
        const ray = this.prices.raydium;
        const orca = this.prices.orca;
        const met = this.prices.meteora;

        const gaps = [
            { a: 'Raydium', b: 'Orca', val: Math.abs(ray - orca) / ray },
            { a: 'Orca', b: 'Meteora', val: Math.abs(orca - met) / orca },
            { a: 'Meteora', b: 'Raydium', val: Math.abs(met - ray) / met }
        ];

        const bestGap = gaps.sort((x, y) => y.val - x.val)[0];

        if (bestGap.val > 0.001) { // 0.1% threshold for visual ping
            this.elements.alert.innerHTML = `<span>⚡</span> ARBITRAGE DETECTED: ${(bestGap.val * 100).toFixed(3)}%`;
            this.elements.alert.classList.add('active');
            this.addLog(`Found ${(bestGap.val * 100).toFixed(3)}% gap between ${bestGap.a} and ${bestGap.b}`);
        } else {
            this.elements.alert.textContent = 'SCANNING FOR ARBITRAGE...';
            this.elements.alert.classList.remove('active');
        }
    }

    addSwapLog(swap) {
        const item = document.createElement('div');
        item.className = 'log-item swap';
        const time = new Date().toLocaleTimeString();
        item.innerHTML = `
            <span class="time">[${time}]</span>
            <span class="dex">[${swap.dex}]</span>
            <span class="tokens">${swap.tokenIn.slice(0, 4)}... -> ${swap.tokenOut.slice(0, 4)}...</span>
            <span class="price">$${swap.priceUsd.toFixed(4)}</span>
        `;
        this.elements.logs.prepend(item);
        
        if (this.elements.logs.children.length > 30) {
            this.elements.logs.lastChild.remove();
        }
    }

    addLog(msg) {
        const item = document.createElement('div');
        item.className = 'log-item drift';
        item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        this.elements.logs.prepend(item);
        
        if (this.elements.logs.children.length > 20) {
            this.elements.logs.lastChild.remove();
        }
    }

    startRadarAnimation() {
        // Minor rotation shimmer
        let rotate = 0;
        const animate = () => {
            rotate += 0.05;
            // Additional subtle animations could go here
            requestAnimationFrame(animate);
        };
        animate();
    }
}

window.onload = () => new Dashboard();
