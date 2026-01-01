const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration for GitHub Pages
const PORT = process.env.PORT || 3000; // Dynamic port for Heroku/Railway
const STB_PORT = process.env.STB_PORT || 3001;

// GitHub Pages URL
const GITHUB_PAGES_URL = 'https://mahallahtv.github.io/almutathahhiriin';

// Store for connected clients
let stbClients = new Set();
let remoteClients = new Set();

const server = http.createServer((req, res) => {
    // CORS headers for GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API Endpoints
    if (req.url === '/api/connect' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('New connection:', data.device);
                
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    status: 'connected',
                    message: 'Connected to Mahallah TV Server',
                    githubUrl: GITHUB_PAGES_URL,
                    timestamp: Date.now()
                }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid request');
            }
        });
        return;
    }
    
    if (req.url === '/api/command' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const command = JSON.parse(body);
                console.log('Command received:', command.action);
                
                // Broadcast to STB clients
                broadcastToSTB({
                    type: 'command',
                    action: command.action,
                    data: command.data,
                    timestamp: Date.now()
                });
                
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Command sent to STB'
                }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid command');
            }
        });
        return;
    }
    
    // Serve simple status page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Mahallah TV WebSocket Server</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                .status { padding: 10px; margin: 10px 0; }
                .connected { background: #d4edda; }
                .disconnected { background: #f8d7da; }
            </style>
        </head>
        <body>
            <h1>🌐 Mahallah TV WebSocket Server</h1>
            <p>Status: <span style="color:green;">🟢 RUNNING</span></p>
            <p>GitHub Pages: <a href="${GITHUB_PAGES_URL}" target="_blank">${GITHUB_PAGES_URL}</a></p>
            <p>STB Connected: <strong>${stbClients.size}</strong></p>
            <p>Remote Connected: <strong>${remoteClients.size}</strong></p>
            <div class="status ${stbClients.size > 0 ? 'connected' : 'disconnected'}">
                STB Status: ${stbClients.size > 0 ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div class="status ${remoteClients.size > 0 ? 'connected' : 'disconnected'}">
                Remote Status: ${remoteClients.size > 0 ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
        </body>
        </html>
    `);
});

// WebSocket Server for STB
const wssSTB = new WebSocket.Server({ port: STB_PORT });
// WebSocket Server for Remote
const wssRemote = new WebSocket.Server({ server });

wssSTB.on('connection', (ws, req) => {
    console.log('STB connected from:', req.socket.remoteAddress);
    stbClients.add(ws);
    
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'STB Connected to Server',
        githubUrl: GITHUB_PAGES_URL,
        timestamp: Date.now()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('STB:', data);
            
            // Broadcast to all remotes
            broadcastToRemote({
                type: 'stb_update',
                data: data,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('STB message error:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('STB disconnected');
        stbClients.delete(ws);
        broadcastToRemote({
            type: 'stb_disconnected',
            timestamp: Date.now()
        });
    });
});

wssRemote.on('connection', (ws, req) => {
    console.log('Remote connected from:', req.socket.remoteAddress);
    remoteClients.add(ws);
    
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Remote Control Connected',
        stbCount: stbClients.size,
        timestamp: Date.now()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Remote command:', data);
            
            // Handle command
            if (data.type === 'command') {
                broadcastToSTB({
                    type: 'remote_command',
                    action: data.action,
                    data: data.data,
                    timestamp: Date.now()
                });
                
                // Acknowledge
                ws.send(JSON.stringify({
                    type: 'command_ack',
                    action: data.action,
                    success: true,
                    timestamp: Date.now()
                }));
            }
        } catch (e) {
            console.error('Remote message error:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('Remote disconnected');
        remoteClients.delete(ws);
    });
});

function broadcastToSTB(data) {
    const message = JSON.stringify(data);
    stbClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastToRemote(data) {
    const message = JSON.stringify(data);
    remoteClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Mahallah TV Remote Server Running`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 STB WebSocket: ws://localhost:${STB_PORT}`);
    console.log(`🌐 GitHub Pages: ${GITHUB_PAGES_URL}`);
    console.log(`📱 Remote URL: ${GITHUB_PAGES_URL}/remote.html`);
    console.log(`\n💡 Untuk public access, deploy server ini ke:`);
    console.log(`   - Railway.app (gratis)`);
    console.log(`   - Heroku (gratis)`);
    console.log(`   - VPS Anda sendiri`);
});