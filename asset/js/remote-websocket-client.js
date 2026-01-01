// Remote Control WebSocket Client for GitHub Pages
class GitHubRemoteClient {
    constructor() {
        // Server URLs
        this.localServerUrl = 'ws://localhost:3000'; // Local development
        this.publicServerUrl = 'wss://mahallah-tv-server.onrender.com'; // Public server
        
        this.ws = null;
        this.isConnected = false;
        this.stbConnected = false;
        this.reconnectInterval = 5000;
        
        // UI Elements
        this.initializeUI();
    }
    
    initializeUI() {
        // Auto-populate server URL based on environment
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
        
        const serverUrl = isLocal ? 'localhost:3000' : 'mahallah-tv-server.onrender.com';
        
        // Update input field if exists
        const ipInput = document.getElementById('stbIpAddress');
        if (ipInput) {
            ipInput.value = serverUrl;
            ipInput.placeholder = 'Server URL (otomatis terisi)';
        }
    }
    
    connect() {
        const serverInput = document.getElementById('stbIpAddress');
        const serverUrl = serverInput ? serverInput.value.trim() : '';
        
        let wsUrl;
        
        // Determine WebSocket URL
        if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
            wsUrl = this.localServerUrl;
        } else if (serverUrl.includes('render.com') || serverUrl.includes('herokuapp.com')) {
            wsUrl = `wss://${serverUrl}`;
        } else {
            wsUrl = this.publicServerUrl; // Default public server
        }
        
        console.log('Connecting to:', wsUrl);
        this.updateStatus(`Menghubungkan ke ${wsUrl}...`, 'warning');
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Connected to remote server');
                this.isConnected = true;
                this.updateStatus('Terhubung ke server', 'success');
                this.updateConnectionUI(true);
                this.onConnected();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.ws.onclose = () => {
                console.log('❌ Disconnected from server');
                this.isConnected = false;
                this.stbConnected = false;
                this.updateStatus('Terputus dari server', 'error');
                this.updateConnectionUI(false);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('Koneksi error', 'error');
            };
            
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.updateStatus('Gagal menghubungkan', 'error');
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        console.log(`Reconnecting in ${this.reconnectInterval/1000} seconds...`);
        setTimeout(() => this.connect(), this.reconnectInterval);
    }
    
    onConnected() {
        // Send identification
        this.send({
            type: 'remote_identify',
            device: 'remote-control',
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: Date.now()
        });
        
        // Start ping interval
        setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 30000);
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }
    
    handleMessage(message) {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);
            
            switch(data.type) {
                case 'welcome':
                    this.showNotification(`✅ ${data.message}`, 'success');
                    if (data.stbCount !== undefined) {
                        this.stbConnected = data.stbCount > 0;
                        this.updateSTBStatus(this.stbConnected);
                    }
                    break;
                    
                case 'stb_update':
                    this.handleSTBUpdate(data.data);
                    break;
                    
                case 'stb_disconnected':
                    this.stbConnected = false;
                    this.updateSTBStatus(false);
                    this.showNotification('❌ STB terputus', 'error');
                    break;
                    
                case 'command_ack':
                    this.handleCommandAck(data);
                    break;
                    
                case 'pong':
                    // Connection is alive
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    updateStatus(message, type) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
        }
        
        // Update connection dot
        const dot = document.getElementById('connectionDot');
        if (dot) {
            dot.className = 'status-indicator ' + 
                (type === 'success' ? 'connected' : 
                 type === 'warning' ? 'disconnected' : 'disconnected');
        }
    }
    
    updateConnectionUI(connected) {
        const dot = document.getElementById('connectionDot');
        if (dot) {
            dot.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');
        }
        
        const stbInfo = document.getElementById('stbInfo');
        if (stbInfo) {
            stbInfo.style.display = 'block';
        }
    }
    
    updateSTBStatus(connected) {
        this.stbConnected = connected;
        
        const stbStatus = document.getElementById('stbStatus');
        if (stbStatus) {
            stbStatus.textContent = connected ? 'Online' : 'Offline';
            stbStatus.className = connected ? 'text-success' : 'text-danger';
        }
        
        if (connected) {
            this.showNotification('✅ STB Terhubung', 'success');
        }
    }
    
    handleSTBUpdate(data) {
        console.log('STB update:', data);
        // You can update UI with STB data here
    }
    
    handleCommandAck(data) {
        if (data.success) {
            this.showNotification(`✅ Perintah "${data.action}" berhasil`, 'success');
        } else {
            this.showNotification(`❌ Perintah "${data.action}" gagal`, 'error');
        }
    }
    
    sendCommand(action, data = {}) {
        if (!this.isConnected) {
            this.showNotification('⚠️ Tidak terhubung ke server', 'warning');
            return false;
        }
        
        if (!this.stbConnected && action !== 'test_connection') {
            this.showNotification('⚠️ STB tidak terhubung', 'warning');
            return false;
        }
        
        const command = {
            type: 'command',
            action: action,
            data: data,
            timestamp: Date.now()
        };
        
        return this.send(command);
    }
    
    showNotification(message, type = 'info') {
        // Use existing toast or create one
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            // Simple notification
            const container = document.getElementById('toastContainer');
            if (!container) return;
            
            const toast = document.createElement('div');
            toast.className = `alert alert-${type} alert-dismissible fade show`;
            toast.style.minWidth = '300px';
            toast.style.marginBottom = '10px';
            
            const icon = type === 'success' ? 'bi-check-circle' : 
                         type === 'warning' ? 'bi-exclamation-triangle' : 
                         type === 'error' ? 'bi-x-circle' : 'bi-info-circle';
            
            toast.innerHTML = `
                <i class="bi ${icon} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            container.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 5000);
        }
    }
    
    // Public API for remote.html buttons
    updateMasjidData() {
        const data = {
            name: document.getElementById('namaMasjid')?.value || '',
            address: document.getElementById('alamatMasjid')?.value || '',
            logo: document.getElementById('logoPreview')?.src || ''
        };
        
        return this.sendCommand('update_masjid_data', data);
    }
    
    updateRunningText() {
        const text = document.getElementById('runningText')?.value || '';
        return this.sendCommand('update_running_text', { text });
    }
    
    updatePesanSlide() {
        const text = document.getElementById('pesanSlide1')?.value || '';
        return this.sendCommand('update_pesan_slide', { text });
    }
    
    updatePrayerTime(prayerId) {
        const data = {
            prayer: prayerId,
            time: document.getElementById(`time_${prayerId}`)?.value || '',
            offset: document.getElementById(`offset_${prayerId}`)?.value || 0,
            adzanCountdown: document.getElementById(`adzan_${prayerId}`)?.value || 10,
            iqamahCountdown: document.getElementById(`iqamah_${prayerId}`)?.value || 25
        };
        
        return this.sendCommand('update_prayer_time', data);
    }
    
    changeTheme(color) {
        return this.sendCommand('change_theme', { color });
    }
    
    updateSliderSettings() {
        const data = {
            left: document.getElementById('sliderLeft')?.value || 0,
            right: document.getElementById('sliderRight')?.value || 0
        };
        
        return this.sendCommand('update_slider_settings', data);
    }
    
    testConnection() {
        return this.sendCommand('test_connection', {});
    }
}

// Global instance
let githubRemoteClient = null;

function initGitHubRemote() {
    if (!githubRemoteClient) {
        githubRemoteClient = new GitHubRemoteClient();
    }
    return githubRemoteClient;
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check WebSocket support
    if (!('WebSocket' in window || 'MozWebSocket' in window)) {
        alert('Browser Anda tidak mendukung WebSocket. Remote control membutuhkan WebSocket.');
        return;
    }
    
    // Initialize client
    githubRemoteClient = initGitHubRemote();
    
    // Auto-connect after 2 seconds
    setTimeout(() => {
        const savedUrl = localStorage.getItem('server_url');
        if (savedUrl) {
            const ipInput = document.getElementById('stbIpAddress');
            if (ipInput) ipInput.value = savedUrl;
            
            if (confirm('Koneksi otomatis ke server?')) {
                githubRemoteClient.connect();
            }
        }
    }, 2000);
    
    // Save server URL when changed
    const ipInput = document.getElementById('stbIpAddress');
    if (ipInput) {
        ipInput.addEventListener('change', function() {
            localStorage.setItem('server_url', this.value);
        });
    }
});

// Export functions for remote.html buttons
window.connectToSTB = function() {
    if (githubRemoteClient) {
        githubRemoteClient.connect();
    }
};

window.sendCommand = function(action, data) {
    if (githubRemoteClient) {
        return githubRemoteClient.sendCommand(action, data);
    }
    return false;
};

// Export other functions
window.updateMasjidData = function() {
    if (githubRemoteClient) {
        return githubRemoteClient.updateMasjidData();
    }
};

window.updateRunningText = function() {
    if (githubRemoteClient) {
        return githubRemoteClient.updateRunningText();
    }
};

window.updatePesanSlide = function() {
    if (githubRemoteClient) {
        return githubRemoteClient.updatePesanSlide();
    }
};

window.changeTheme = function(color) {
    if (githubRemoteClient) {
        return githubRemoteClient.changeTheme(color);
    }
};

window.updateSliderSettings = function() {
    if (githubRemoteClient) {
        return githubRemoteClient.updateSliderSettings();
    }
};

window.testConnection = function() {
    if (githubRemoteClient) {
        return githubRemoteClient.testConnection();
    }
};