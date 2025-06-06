class PomodoroRoom {
    constructor() {
        this.socket = io();
        this.roomId = this.getRoomIdFromUrl();
        this.userName = localStorage.getItem('userName') || 'Anonymous';
        this.roomState = null;
        this.achievements = new Set();
        this.currentTip = 0;
        this.settings = {
            notifications: true,
            sounds: true,
            autoStartBreaks: false
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.joinRoom();
        this.initTipCarousel();
        this.loadSettings();
        this.initParticles();
    }

    getRoomIdFromUrl() {
        const path = window.location.pathname;
        return path.split('/room/')[1];
    }

    bindEvents() {
        // Socket events
        this.socket.on('room-state', (state) => this.updateRoomState(state));
        this.socket.on('timer-started', (state) => this.onTimerStarted(state));
        this.socket.on('timer-paused', (state) => this.onTimerPaused(state));
        this.socket.on('timer-update', (timerState) => this.updateTimer(timerState));
        this.socket.on('session-completed', (state) => this.onSessionCompleted(state));
        this.socket.on('participant-joined', (data) => this.onParticipantJoined(data));
        this.socket.on('participant-left', (data) => this.onParticipantLeft(data));
        this.socket.on('error', (error) => this.showNotification(error.message, 'error'));

        // UI events
        document.getElementById('startPauseBtn').addEventListener('click', () => this.toggleTimer());
        document.getElementById('skipBtn').addEventListener('click', () => this.skipSession());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
        document.getElementById('copyRoomLink').addEventListener('click', () => this.copyRoomLink());
        document.getElementById('shareRoom').addEventListener('click', () => this.shareRoom());
        document.getElementById('roomSettings').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('inviteMore').addEventListener('click', () => this.copyRoomLink());
        document.getElementById('continueBtn').addEventListener('click', () => this.hideSessionCompleteModal());

        // Tab switching
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Settings
        document.getElementById('enableNotifications').addEventListener('change', (e) => {
            this.settings.notifications = e.target.checked;
            this.saveSettings();
        });
        document.getElementById('enableSounds').addEventListener('change', (e) => {
            this.settings.sounds = e.target.checked;
            this.saveSettings();
        });
        document.getElementById('autoStartBreaks').addEventListener('change', (e) => {
            this.settings.autoStartBreaks = e.target.checked;
            this.saveSettings();
        });
    }

    joinRoom() {
        this.socket.emit('join-room', {
            roomId: this.roomId,
            userName: this.userName
        });
    }

    updateRoomState(state) {
        this.roomState = state;
        this.updateUI();
    }

    updateUI() {
        if (!this.roomState) return;

        // Update room info
        document.getElementById('roomIdDisplay').textContent = this.roomState.id;
        document.getElementById('participantCount').textContent = this.roomState.participants.length;
        document.getElementById('participantCountText').textContent = this.roomState.participants.length;
        document.getElementById('sessionsCompleted').textContent = this.roomState.timerState.sessionsCompleted;
        document.getElementById('totalSessions').textContent = this.roomState.stats.totalSessions;
        document.getElementById('totalFocusTime').textContent = this.formatTime(this.roomState.stats.totalFocusTime);

        // Update timer
        this.updateTimer(this.roomState.timerState);

        // Update participants
        this.updateParticipants();

        // Update controls
        this.updateControls();
    }

    updateTimer(timerState) {
        const timeDisplay = document.getElementById('timeDisplay');
        const sessionType = document.getElementById('sessionType');
        const timerProgress = document.getElementById('timerProgress');

        // Format time
        const minutes = Math.floor(timerState.timeRemaining / 60000);
        const seconds = Math.floor((timerState.timeRemaining % 60000) / 1000);
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update session type
        const sessionTypes = {
            focus: '🎯 Focus Time',
            shortBreak: '☕ Short Break',
            longBreak: '🌴 Long Break'
        };
        sessionType.textContent = sessionTypes[timerState.currentSession] || 'Focus Time';

        // Update progress circle
        const totalTime = this.getTotalTimeForSession(timerState.currentSession);
        const progress = ((totalTime - timerState.timeRemaining) / totalTime) * 100;
        const circumference = 2 * Math.PI * 45;
        const strokeDashoffset = circumference - (progress / 100) * circumference;
        timerProgress.style.strokeDashoffset = strokeDashoffset;

        // Update glow effect
        const timerGlow = document.getElementById('timerGlow');
        if (timerGlow) {
            timerGlow.style.strokeDashoffset = strokeDashoffset;
        }

        // Update session counter and dots
        this.updateSessionIndicators(timerState);

        // Update progress visualization
        this.updateProgressVisualization();

        // Update page title
        document.title = `${timeDisplay.textContent} - ${sessionTypes[timerState.currentSession]} - Silent Pomodoro`;
    }

    getTotalTimeForSession(sessionType) {
        switch (sessionType) {
            case 'focus': return 25 * 60 * 1000;
            case 'shortBreak': return 5 * 60 * 1000;
            case 'longBreak': return 15 * 60 * 1000;
            default: return 25 * 60 * 1000;
        }
    }

    updateControls() {
        const startPauseBtn = document.getElementById('startPauseBtn');
        const icon = startPauseBtn.querySelector('i');
        const text = startPauseBtn.querySelector('span');

        if (this.roomState.timerState.isRunning) {
            icon.className = 'fas fa-pause';
            text.textContent = 'Pause';
            startPauseBtn.classList.remove('btn-primary');
            startPauseBtn.classList.add('btn-warning');
        } else {
            icon.className = 'fas fa-play';
            text.textContent = 'Start';
            startPauseBtn.classList.remove('btn-warning');
            startPauseBtn.classList.add('btn-primary');
        }
    }

    updateParticipants() {
        const participantsList = document.getElementById('participantsList');
        participantsList.innerHTML = '';

        this.roomState.participants.forEach(participant => {
            const participantElement = document.createElement('div');
            participantElement.className = 'participant-card';
            participantElement.innerHTML = `
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="participant-info">
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-stats">
                        <span class="sessions">${participant.sessionsCompleted} sessions</span>
                        <span class="focus-time">${this.formatTime(participant.totalFocusTime)}</span>
                    </div>
                </div>
                <div class="participant-status ${participant.isActive ? 'active' : 'inactive'}">
                    <i class="fas fa-circle"></i>
                </div>
            `;
            participantsList.appendChild(participantElement);
        });
    }

    toggleTimer() {
        if (this.roomState.timerState.isRunning) {
            this.socket.emit('pause-timer', { roomId: this.roomId });
        } else {
            this.socket.emit('start-timer', { roomId: this.roomId });
        }
    }

    skipSession() {
        if (confirm('Are you sure you want to skip this session?')) {
            this.socket.emit('complete-session', { roomId: this.roomId });
        }
    }

    onTimerStarted(state) {
        this.updateRoomState(state);
        this.showNotification('Timer started! 🎯', 'success');
    }

    onTimerPaused(state) {
        this.updateRoomState(state);
        this.showNotification('Timer paused ⏸️', 'info');
    }

    onSessionCompleted(state) {
        this.updateRoomState(state);
        this.showSessionCompleteModal();
        this.playNotificationSound();
    }

    onParticipantJoined(data) {
        this.updateRoomState(data.roomState);
        this.showNotification(`${data.participant.name} joined the room! 👋`, 'success');
    }

    onParticipantLeft(data) {
        this.updateRoomState(data.roomState);
        this.showNotification('Someone left the room 👋', 'info');
    }

    showSessionCompleteModal() {
        const modal = document.getElementById('sessionCompleteModal');
        const title = document.getElementById('modalTitle');
        const message = document.getElementById('modalMessage');

        const sessionType = this.roomState.timerState.currentSession;
        if (sessionType === 'shortBreak' || sessionType === 'longBreak') {
            title.textContent = '☕ Break Time!';
            message.textContent = 'Take a well-deserved break. You\'ve earned it!';
        } else {
            title.textContent = '🎯 Focus Time!';
            message.textContent = 'Time to focus! Let\'s make this session count.';
        }

        modal.classList.remove('hidden');
    }

    hideSessionCompleteModal() {
        document.getElementById('sessionCompleteModal').classList.add('hidden');
    }

    copyRoomLink() {
        const roomLink = `${window.location.origin}/room/${this.roomId}`;
        navigator.clipboard.writeText(roomLink).then(() => {
            this.showNotification('Room link copied to clipboard! 📋', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = roomLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Room link copied! 📋', 'success');
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        const container = document.getElementById('notifications');
        container.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => container.removeChild(notification), 300);
        }, 3000);
    }

    playNotificationSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Could not play notification sound');
        }
    }

    formatTime(milliseconds) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // New enhanced methods
    initParticles() {
        // Particles are handled by CSS, but we could add dynamic effects here
        console.log('Particles initialized');
    }

    initTipCarousel() {
        const tips = document.querySelectorAll('.tip');
        if (tips.length === 0) return;

        setInterval(() => {
            tips[this.currentTip].classList.remove('active');
            this.currentTip = (this.currentTip + 1) % tips.length;
            tips[this.currentTip].classList.add('active');
        }, 10000); // Change tip every 10 seconds
    }

    updateSessionIndicators(timerState) {
        // Update session counter
        const currentSessionSpan = document.getElementById('currentSession');
        if (currentSessionSpan) {
            const sessionNumber = (timerState.sessionsCompleted % 4) + 1;
            currentSessionSpan.textContent = sessionNumber;
        }

        // Update session dots
        const dots = document.querySelectorAll('.session-dot');
        dots.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index < timerState.sessionsCompleted % 4) {
                dot.classList.add('completed');
            } else if (index === timerState.sessionsCompleted % 4) {
                dot.classList.add('active');
            }
        });
    }

    updateProgressVisualization() {
        if (!this.roomState) return;

        const progressFill = document.getElementById('progressFill');
        const completedSessions = this.roomState.timerState.sessionsCompleted;
        const progress = Math.min((completedSessions / 4) * 100, 100);

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all tabs
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab content
        const tabContent = document.getElementById(`${tabName}Tab`);
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);

        if (tabContent) tabContent.classList.add('active');
        if (tabButton) tabButton.classList.add('active');
    }

    resetTimer() {
        if (confirm('Are you sure you want to reset the current session?')) {
            this.socket.emit('reset-timer', { roomId: this.roomId });
        }
    }

    shareRoom() {
        if (navigator.share) {
            navigator.share({
                title: 'Join my Focus Room',
                text: 'Let\'s focus together in this Pomodoro session!',
                url: window.location.href
            });
        } else {
            this.copyRoomLink();
        }
    }

    showSettingsModal() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('pomodoroSettings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }

        // Apply settings to UI
        document.getElementById('enableNotifications').checked = this.settings.notifications;
        document.getElementById('enableSounds').checked = this.settings.sounds;
        document.getElementById('autoStartBreaks').checked = this.settings.autoStartBreaks;
    }

    saveSettings() {
        localStorage.setItem('pomodoroSettings', JSON.stringify(this.settings));
    }

    showAchievementPopup(achievement) {
        const popup = document.getElementById('achievementPopup');
        const text = popup.querySelector('.achievement-text');

        text.textContent = achievement;
        popup.classList.add('show');

        setTimeout(() => {
            popup.classList.remove('show');
        }, 4000);
    }

    checkAchievements() {
        if (!this.roomState) return;

        const completedSessions = this.roomState.timerState.sessionsCompleted;

        // First session achievement
        if (completedSessions >= 1 && !this.achievements.has('first-session')) {
            this.achievements.add('first-session');
            this.unlockAchievement('first-session', 'First Focus Complete!');
        }

        // Marathon achievement (4+ sessions)
        if (completedSessions >= 4 && !this.achievements.has('marathon')) {
            this.achievements.add('marathon');
            this.unlockAchievement('marathon', 'Marathon Achiever!');
        }

        // Update achievement display
        this.updateAchievementBadges();
    }

    unlockAchievement(achievementId, message) {
        // Update badge
        const badge = document.querySelector(`[data-achievement="${achievementId}"]`);
        if (badge) {
            badge.classList.remove('locked');
            badge.classList.add('unlocked');
        }

        // Show popup
        this.showAchievementPopup(message);

        // Show in session complete modal
        const achievementEarned = document.getElementById('achievementEarned');
        if (achievementEarned) {
            achievementEarned.style.display = 'flex';
        }
    }

    updateAchievementBadges() {
        this.achievements.forEach(achievement => {
            const badge = document.querySelector(`[data-achievement="${achievement}"]`);
            if (badge) {
                badge.classList.remove('locked');
                badge.classList.add('unlocked');
            }
        });
    }

    addToHistory(action) {
        const historyContainer = document.getElementById('sessionHistory');
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        historyItem.innerHTML = `
            <div class="history-time">${timeString}</div>
            <div class="history-action">${action}</div>
        `;

        historyContainer.insertBefore(historyItem, historyContainer.firstChild);

        // Keep only last 10 items
        const items = historyContainer.querySelectorAll('.history-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }
    }

    // Override existing methods to add enhanced functionality
    onTimerStarted(state) {
        this.updateRoomState(state);
        this.showNotification('Timer started! 🎯', 'success');
        this.addToHistory('Started focus session');
    }

    onTimerPaused(state) {
        this.updateRoomState(state);
        this.showNotification('Timer paused ⏸️', 'info');
        this.addToHistory('Paused session');
    }

    onSessionCompleted(state) {
        this.updateRoomState(state);
        this.checkAchievements();
        this.showSessionCompleteModal();

        // Enhanced completion notification
        if (this.settings.sounds) {
            this.playNotificationSound();
        }

        // Update modal with current stats
        const modalSessionCount = document.getElementById('modalSessionCount');
        const modalFocusTime = document.getElementById('modalFocusTime');

        if (modalSessionCount) {
            modalSessionCount.textContent = state.timerState.sessionsCompleted;
        }
        if (modalFocusTime) {
            modalFocusTime.textContent = this.formatTime(state.stats.totalFocusTime);
        }

        this.addToHistory('Completed session');
    }

    onParticipantJoined(data) {
        this.updateRoomState(data.roomState);
        this.showNotification(`${data.participant.name} joined the room! 👋`, 'success');
        this.addToHistory(`${data.participant.name} joined`);
    }

    onParticipantLeft(data) {
        this.updateRoomState(data.roomState);
        this.showNotification('Someone left the room 👋', 'info');
        this.addToHistory('Someone left the room');
    }

    playNotificationSound() {
        if (!this.settings.sounds) return;

        // Enhanced notification sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create a more pleasant sound sequence
            const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5

            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const startTime = audioContext.currentTime + (index * 0.2);
                gainNode.gain.setValueAtTime(0.2, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

                oscillator.start(startTime);
                oscillator.stop(startTime + 0.3);
            });
        } catch (error) {
            console.log('Could not play notification sound');
        }
    }
}

// Initialize the room when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroRoom();
}); 