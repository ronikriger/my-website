class PomodoroRoom {
    constructor() {
        // Get room ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('id');

        if (!this.roomId) {
            alert('Invalid room ID. Redirecting to home...');
            window.location.href = 'index.html';
            return;
        }

        this.userName = localStorage.getItem('userName') || 'Anonymous';
        this.roomState = null;
        this.achievements = new Set();
        this.currentTip = 0;
        this.timerInterval = null;
        this.updateInterval = null;
        this.settings = {
            notifications: true,
            sounds: true,
            autoStartBreaks: false
        };

        this.init();
    }

    init() {
        this.loadRoom();
        this.bindEvents();
        this.initTipCarousel();
        this.loadSettings();
        this.initParticles();
        this.startUpdateLoop();
        this.addToHistory('Joined the focus room');
    }

    loadRoom() {
        // Load room from localStorage or create if doesn't exist
        let roomData = localStorage.getItem(`room_${this.roomId}`);

        if (!roomData) {
            // Create new room if it doesn't exist
            this.roomState = {
                id: this.roomId,
                creator: this.userName,
                participants: [],
                timerState: {
                    isRunning: false,
                    currentSession: 'focus',
                    timeRemaining: 25 * 60 * 1000,
                    sessionsCompleted: 0,
                    startTime: null,
                    endTime: null
                },
                stats: {
                    totalFocusTime: 0,
                    totalSessions: 0,
                    participantCount: 0
                }
            };
            this.saveRoom();
        } else {
            this.roomState = JSON.parse(roomData);
        }

        // Add current user as participant if not already there
        const existingParticipant = this.roomState.participants.find(p => p.name === this.userName);
        if (!existingParticipant) {
            this.roomState.participants.push({
                id: 'local_' + Date.now(),
                name: this.userName,
                joinedAt: Date.now(),
                sessionsCompleted: 0,
                totalFocusTime: 0,
                isActive: true
            });
            this.roomState.stats.participantCount = this.roomState.participants.length;
            this.saveRoom();
        }

        this.updateUI();
    }

    saveRoom() {
        localStorage.setItem(`room_${this.roomId}`, JSON.stringify(this.roomState));
    }

    bindEvents() {
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

    startUpdateLoop() {
        // Update timer every second
        this.updateInterval = setInterval(() => {
            if (this.roomState.timerState.isRunning) {
                const now = Date.now();
                this.roomState.timerState.timeRemaining = Math.max(0, this.roomState.timerState.endTime - now);

                if (this.roomState.timerState.timeRemaining <= 0) {
                    this.completeSession();
                } else {
                    this.updateTimer(this.roomState.timerState);
                }

                this.saveRoom();
            }
        }, 1000);
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

        // Update session indicators
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
            text.textContent = this.roomState.timerState.currentSession === 'focus' ? 'Start Focus' : 'Start Break';
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
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        this.roomState.timerState.isRunning = true;
        this.roomState.timerState.startTime = Date.now();
        this.roomState.timerState.endTime = this.roomState.timerState.startTime + this.roomState.timerState.timeRemaining;

        this.updateControls();
        this.saveRoom();
        this.showNotification('Timer started! 🎯', 'success');
        this.addToHistory('Started focus session');
    }

    pauseTimer() {
        this.roomState.timerState.isRunning = false;
        this.roomState.timerState.timeRemaining = Math.max(0, this.roomState.timerState.endTime - Date.now());

        this.updateControls();
        this.saveRoom();
        this.showNotification('Timer paused ⏸️', 'info');
        this.addToHistory('Paused session');
    }

    skipSession() {
        if (confirm('Are you sure you want to skip this session?')) {
            this.completeSession();
        }
    }

    resetTimer() {
        if (confirm('Are you sure you want to reset the current session?')) {
            this.roomState.timerState.isRunning = false;
            this.roomState.timerState.timeRemaining = this.getTotalTimeForSession(this.roomState.timerState.currentSession);
            this.updateUI();
            this.saveRoom();
            this.showNotification('Timer reset! ↺', 'info');
            this.addToHistory('Reset timer');
        }
    }

    completeSession() {
        this.roomState.timerState.isRunning = false;
        this.roomState.timerState.sessionsCompleted++;
        this.roomState.stats.totalSessions++;

        // Update participant stats
        const currentUser = this.roomState.participants.find(p => p.name === this.userName);
        if (currentUser && this.roomState.timerState.currentSession === 'focus') {
            currentUser.sessionsCompleted++;
            currentUser.totalFocusTime += 25 * 60 * 1000;
            this.roomState.stats.totalFocusTime += 25 * 60 * 1000;
        }

        // Determine next session type
        if (this.roomState.timerState.currentSession === 'focus') {
            if (this.roomState.timerState.sessionsCompleted % 4 === 0) {
                this.roomState.timerState.currentSession = 'longBreak';
                this.roomState.timerState.timeRemaining = 15 * 60 * 1000;
            } else {
                this.roomState.timerState.currentSession = 'shortBreak';
                this.roomState.timerState.timeRemaining = 5 * 60 * 1000;
            }
        } else {
            this.roomState.timerState.currentSession = 'focus';
            this.roomState.timerState.timeRemaining = 25 * 60 * 1000;
        }

        this.checkAchievements();
        this.updateUI();
        this.saveRoom();
        this.showSessionCompleteModal();

        if (this.settings.sounds) {
            this.playNotificationSound();
        }

        this.addToHistory('Completed session');
    }

    // Enhanced methods from the previous version
    initParticles() {
        console.log('Particles initialized');
    }

    initTipCarousel() {
        const tips = document.querySelectorAll('.tip');
        if (tips.length === 0) return;

        setInterval(() => {
            tips[this.currentTip].classList.remove('active');
            this.currentTip = (this.currentTip + 1) % tips.length;
            tips[this.currentTip].classList.add('active');
        }, 10000);
    }

    updateSessionIndicators(timerState) {
        const currentSessionSpan = document.getElementById('currentSession');
        if (currentSessionSpan) {
            const sessionNumber = (timerState.sessionsCompleted % 4) + 1;
            currentSessionSpan.textContent = sessionNumber;
        }

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
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const tabContent = document.getElementById(`${tabName}Tab`);
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);

        if (tabContent) tabContent.classList.add('active');
        if (tabButton) tabButton.classList.add('active');
    }

    shareRoom() {
        const roomUrl = `${window.location.origin}${window.location.pathname}?id=${this.roomId}`;

        if (navigator.share) {
            navigator.share({
                title: 'Join my Focus Room',
                text: 'Let\'s focus together in this Pomodoro session!',
                url: roomUrl
            });
        } else {
            this.copyRoomLink();
        }
    }

    copyRoomLink() {
        const roomUrl = `${window.location.origin}${window.location.pathname}?id=${this.roomId}`;

        navigator.clipboard.writeText(roomUrl).then(() => {
            this.showNotification('Room link copied to clipboard! 📋', 'success');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = roomUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Room link copied! 📋', 'success');
        });
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

        document.getElementById('enableNotifications').checked = this.settings.notifications;
        document.getElementById('enableSounds').checked = this.settings.sounds;
        document.getElementById('autoStartBreaks').checked = this.settings.autoStartBreaks;
    }

    saveSettings() {
        localStorage.setItem('pomodoroSettings', JSON.stringify(this.settings));
    }

    checkAchievements() {
        if (!this.roomState) return;

        const completedSessions = this.roomState.timerState.sessionsCompleted;

        if (completedSessions >= 1 && !this.achievements.has('first-session')) {
            this.achievements.add('first-session');
            this.unlockAchievement('first-session', 'First Focus Complete!');
        }

        if (completedSessions >= 4 && !this.achievements.has('marathon')) {
            this.achievements.add('marathon');
            this.unlockAchievement('marathon', 'Marathon Achiever!');
        }

        this.updateAchievementBadges();
    }

    unlockAchievement(achievementId, message) {
        const badge = document.querySelector(`[data-achievement="${achievementId}"]`);
        if (badge) {
            badge.classList.remove('locked');
            badge.classList.add('unlocked');
        }

        this.showAchievementPopup(message);

        const achievementEarned = document.getElementById('achievementEarned');
        if (achievementEarned) {
            achievementEarned.style.display = 'flex';
        }
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

        const items = historyContainer.querySelectorAll('.history-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }
    }

    showSessionCompleteModal() {
        const modal = document.getElementById('sessionCompleteModal');
        const title = document.getElementById('modalTitle');
        const message = document.getElementById('modalMessage');
        const modalSessionCount = document.getElementById('modalSessionCount');
        const modalFocusTime = document.getElementById('modalFocusTime');

        const sessionType = this.roomState.timerState.currentSession;
        if (sessionType === 'shortBreak' || sessionType === 'longBreak') {
            title.textContent = '☕ Break Time!';
            message.textContent = 'Take a well-deserved break. You\'ve earned it!';
        } else {
            title.textContent = '🎯 Focus Time!';
            message.textContent = 'Time to focus! Let\'s make this session count.';
        }

        if (modalSessionCount) {
            modalSessionCount.textContent = this.roomState.timerState.sessionsCompleted;
        }
        if (modalFocusTime) {
            modalFocusTime.textContent = this.formatTime(this.roomState.stats.totalFocusTime);
        }

        modal.classList.remove('hidden');
    }

    hideSessionCompleteModal() {
        document.getElementById('sessionCompleteModal').classList.add('hidden');

        if (this.settings.autoStartBreaks) {
            setTimeout(() => {
                this.startTimer();
            }, 1000);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        const container = document.getElementById('notifications');
        container.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => container.removeChild(notification), 300);
        }, 3000);
    }

    playNotificationSound() {
        if (!this.settings.sounds) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const frequencies = [523.25, 659.25, 783.99];

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

    formatTime(milliseconds) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}

// Initialize the room when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroRoom();
}); 