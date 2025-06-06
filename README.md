# 🎯 Silent Pomodoro Room

A fully interactive and gamified website for synchronized Pomodoro sessions. Create shareable "focus rooms" with real-time timers perfect for virtual co-working, study groups, and productivity sessions with friends.

## ✨ Features

### 🔄 Synchronized Timers
- Real-time synchronized Pomodoro timers across all participants
- Automatic session transitions: 25min focus → 5min break → repeat → 15min long break
- Visual progress indicators with beautiful circular timers

### 🎮 Gamified Experience
- Live participant tracking with individual statistics
- Session completion tracking and achievements
- Real-time notifications and celebrations
- Beautiful visual feedback and animations

### 👥 Social Accountability
- See who's currently active in your room
- Real-time participant join/leave notifications
- Shareable room links for easy collaboration
- Individual progress tracking per participant

### 📊 Progress Tracking
- Total sessions completed counter
- Focus time accumulation
- Personal and room-wide statistics
- Visual progress indicators

### 🎨 Modern UI/UX
- Responsive design that works on all devices
- Beautiful gradients and glassmorphism effects
- Smooth animations and transitions
- Intuitive controls and interactions

## 🚀 Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Clone and setup the project:**
   ```bash
   cd Pomodoro
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   Or for production:
   ```bash
   npm start
   ```

3. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## 🎯 How to Use

### Creating a Room
1. Go to the homepage
2. Enter your name in the "Create a Room" section
3. Click "Create Room" to generate a unique room code
4. Share the room link with friends or colleagues

### Joining a Room
1. Get a room code from someone who created a room
2. Enter the room code and your name
3. Click "Join Room" to enter the session

### Using the Timer
- **Start/Pause**: Click the main timer button to start or pause the session
- **Skip**: Use the skip button to move to the next session type
- **Progress**: Watch the circular progress indicator and time display
- **Notifications**: Receive audio and visual notifications when sessions complete

### Room Features
- **Copy Link**: Use the copy button next to the room code to share the room
- **Live Stats**: Monitor participant count and completed sessions
- **Participant List**: See everyone in the room and their individual progress

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js framework
- **Socket.IO** for real-time communication
- **UUID** for unique room generation
- **CORS** for cross-origin resource sharing

### Frontend
- **Vanilla JavaScript** with modern ES6+ features
- **HTML5** with semantic structure
- **CSS3** with advanced features (Grid, Flexbox, Animations)
- **Socket.IO Client** for real-time updates

### Key Features Implementation
- **Real-time synchronization** via WebSocket connections
- **Responsive design** with mobile-first approach
- **Progressive Web App** capabilities
- **Cross-browser compatibility**

## 📱 Responsive Design

The application is fully responsive and works seamlessly across:
- 📱 Mobile phones (portrait and landscape)
- 📱 Tablets
- 💻 Laptops and desktops
- 🖥️ Large monitors

## 🎨 Design Features

### Visual Elements
- **Glassmorphism effects** with backdrop filters
- **Gradient backgrounds** and smooth color transitions
- **Circular progress indicators** with SVG animations
- **Notification system** with slide-in animations
- **Modal dialogs** for session transitions

### Accessibility
- High contrast color schemes
- Clear typography with Inter font family
- Intuitive button layouts and hover effects
- Responsive touch targets for mobile devices

## 🔧 Configuration

### Timer Settings
Current timer settings (can be modified in `server.js`):
- **Focus Session**: 25 minutes
- **Short Break**: 5 minutes  
- **Long Break**: 15 minutes
- **Long Break Interval**: Every 4 completed focus sessions

### Customization
- Modify timer durations in the server configuration
- Customize colors and themes in the CSS file
- Add additional gamification features
- Extend participant statistics

## 🌐 Deployment

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm start  # Standard Node.js server
```

### Environment Variables
- `PORT`: Server port (default: 3000)

## 🤝 Contributing

This is a complete, ready-to-use Pomodoro room application. Feel free to:
- Add new gamification features
- Improve the UI/UX design
- Add more timer customization options
- Implement user accounts and persistent data
- Add audio/music integration

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

---

**Ready to focus together? Start your Silent Pomodoro Room now! 🎯⏰** 