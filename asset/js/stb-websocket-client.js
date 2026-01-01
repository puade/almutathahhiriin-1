// Mahallah TV WebSocket Client for GitHub Pages
class GitHubWebSocketClient {
    constructor() {
        // Server configuration
        this.serverUrl = 'ws://localhost:3001'; // Local testing
        this.publicServerUrl = 'wss://mahallah-tv-server.onrender.com'; // Public server
        
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        // Settings storage
        this.settings = this.loadSettings();
    }
    
    connect() {
        // Try to determine which server to use
        let url;
        
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1') {
            url = this.serverUrl; // Local development
        } else {
            url = this.publicServerUrl; // GitHub Pages
        }
        
        console.log('Connecting to WebSocket server:', url);
        
        try {
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                console.log('✅ Connected to Mahallah TV Server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnected();
                
                // Show notification
                this.showNotification('Terhubung ke server remote', 'success');
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.ws.onclose = () => {
                console.log('❌ Disconnected from server');
                this.isConnected = false;
                this.onDisconnected();
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Koneksi error', 'error');
            };
            
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting attempt ${this.reconnectAttempts} in 3s...`);
            
            setTimeout(() => this.connect(), 3000);
        } else {
            console.error('Max reconnection attempts reached');
            this.showNotification('Tidak bisa terhubung ke server. Refresh halaman.', 'error');
        }
    }
    
    onConnected() {
        // Send identification
        this.send({
            type: 'stb_identify',
            device: 'STB-HG680-P',
            appVersion: '2.0',
            location: window.location.href,
            timestamp: Date.now()
        });
    }
    
    onDisconnected() {
        this.showNotification('Terputus dari server', 'warning');
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
                    console.log('Server:', data.message);
                    break;
                    
                case 'remote_command':
                    this.handleRemoteCommand(data);
                    break;
                    
                case 'command':
                    this.handleCommand(data.action, data.data);
                    break;
                    
                case 'ping':
                    this.send({ type: 'pong', timestamp: Date.now() });
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    handleRemoteCommand(data) {
        console.log('Remote command:', data);
        
        // Execute command based on action
        switch(data.action) {
            case 'update_masjid_data':
                this.updateMasjidData(data.data);
                break;
                
            case 'update_running_text':
                this.updateRunningText(data.data);
                break;
                
            case 'update_pesan_slide':
                this.updatePesanSlide(data.data);
                break;
                
            case 'update_prayer_time':
                this.updatePrayerTime(data.data);
                break;
                
            case 'change_theme':
                this.changeTheme(data.data);
                break;
                
            case 'update_slider_settings':
                this.updateSliderSettings(data.data);
                break;
                
            case 'screen_off':
                this.screenOff();
                break;
                
            case 'screen_on':
                this.screenOn();
                break;
                
            case 'audio_stop_all':
                if (typeof stopAllAudio === 'function') {
                    stopAllAudio();
                }
                break;
                
            case 'test_audio':
                this.testAudio(data.data);
                break;
        }
        
        // Show notification
        this.showNotification(`Perintah dari remote: ${data.action}`, 'info');
    }
    
    handleCommand(action, data) {
        console.log('Command:', action, data);
        this.handleRemoteCommand({ action, data });
    }
    
    // Command implementations
    updateMasjidData(data) {
        // Update UI elements
        if (data.name && document.getElementById('masjidName')) {
            document.getElementById('masjidName').textContent = data.name;
            document.getElementById('namaMasjidInput').value = data.name;
        }
        
        if (data.address && document.getElementById('masjidAddress')) {
            document.getElementById('masjidAddress').textContent = data.address;
            document.getElementById('alamatMasjidInput').value = data.address;
        }
        
        if (data.logo && data.logo.startsWith('data:image')) {
            const logoImg = document.getElementById('masjidLogo');
            if (logoImg) logoImg.src = data.logo;
        }
        
        // Save to local storage
        this.settings.masjidName = data.name || this.settings.masjidName;
        this.settings.masjidAddress = data.address || this.settings.masjidAddress;
        if (data.logo) this.settings.logo = data.logo;
        this.saveSettings();
        
        this.showNotification('Data masjid diperbarui', 'success');
    }
    
    updateRunningText(data) {
        if (data.text && document.getElementById('runningTextDisplay')) {
            document.getElementById('runningTextDisplay').innerHTML = data.text;
        }
        
        this.settings.runningText = data.text || '';
        this.saveSettings();
        this.showNotification('Running text diperbarui', 'success');
    }
    
    updatePesanSlide(data) {
        if (data.text) {
            const formattedText = data.text.replace(/\n/g, '\\n');
            if (typeof settings !== 'undefined') {
                settings.customMessage = formattedText;
            }
            
            // Update textarea if exists
            const textarea = document.getElementById('pesanTeksInput');
            if (textarea) {
                textarea.value = data.text;
            }
            
            // Reload carousel
            if (typeof loadLeftCarousel === 'function') {
                setTimeout(() => loadLeftCarousel(), 500);
            }
        }
        
        this.showNotification('Pesan slide diperbarui', 'success');
    }
    
    updatePrayerTime(data) {
        // Implementation depends on your existing prayer time functions
        console.log('Update prayer time:', data);
        this.showNotification(`Waktu ${data.prayer} diperbarui`, 'success');
    }
    
    changeTheme(data) {
        if (typeof changeThemeColor === 'function') {
            changeThemeColor(data.color);
        }
        this.showNotification('Tema warna diperbarui', 'success');
    }
    
    updateSliderSettings(data) {
        console.log('Update slider settings:', data);
        this.showNotification('Durasi slider diperbarui', 'success');
    }
    
    screenOff() {
        const screenBlack = document.getElementById('screenblack');
        if (screenBlack) screenBlack.style.display = 'block';
        this.showNotification('Screen OFF', 'info');
    }
    
    screenOn() {
        const screenBlack = document.getElementById('screenblack');
        if (screenBlack) screenBlack.style.display = 'none';
        this.showNotification('Screen ON', 'success');
    }
    
    testAudio(data) {
        console.log('Test audio:', data);
        // Your audio test implementation
    }
    
    showNotification(message, type = 'info') {
        // Use existing toast or create simple one
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            // Simple notification
            console.log(`${type}: ${message}`);
        }
    }
    
    loadSettings() {
        try {
            return JSON.parse(localStorage.getItem('mahallah_settings')) || {};
        } catch (e) {
            return {};
        }
    }
    
    saveSettings() {
        localStorage.setItem('mahallah_settings', JSON.stringify(this.settings));
    }
}

// Initialize and export
let githubWebSocketClient = null;

function initGitHubWebSocket() {
    if (!githubWebSocketClient) {
        githubWebSocketClient = new GitHubWebSocketClient();
        githubWebSocketClient.connect();
    }
    return githubWebSocketClient;
}

// Auto-initialize after page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            initGitHubWebSocket();
        }, 3000);
    });
}

// Export for manual initialization
if (typeof module !== 'undefined') {
    module.exports = { GitHubWebSocketClient, initGitHubWebSocket };
}