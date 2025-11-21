# Video Demo Recording Guide

Complete guide for creating a professional 1-2 minute demo video of the DEX Order Execution Engine.

## Table of Contents

1. [Pre-Recording Checklist](#pre-recording-checklist)
2. [Recording Setup](#recording-setup)
3. [Video Script](#video-script)
4. [Recording Steps](#recording-steps)
5. [Post-Production](#post-production)
6. [Upload Instructions](#upload-instructions)

---

## Pre-Recording Checklist

### Environment Preparation

- [ ] Server deployed to Railway and running
- [ ] MongoDB connected and healthy
- [ ] Redis connected and healthy
- [ ] Public URL accessible
- [ ] Test all endpoints working
- [ ] Demo script tested locally

### Technical Setup

- [ ] Screen recording software installed
  - **macOS**: QuickTime Player or OBS Studio
  - **Windows**: OBS Studio or Xbox Game Bar
  - **Linux**: OBS Studio or SimpleScreenRecorder

- [ ] Terminal configured
  - Font size: 14-16pt (readable on video)
  - Color scheme: High contrast (dark background recommended)
  - Window size: Maximized or 1920x1080

- [ ] Browser ready
  - Tabs open: Railway dashboard, GitHub repo
  - Extensions: Dark Reader for better contrast (optional)

### Content Preparation

- [ ] README.md reviewed
- [ ] API documentation ready
- [ ] Postman collection imported
- [ ] Demo script ready to run

---

## Recording Setup

### Screen Recording Tools

#### Option 1: OBS Studio (Recommended - Free & Professional)

**Download:** [obsproject.com](https://obsproject.com/)

**Setup:**
1. Create new Scene
2. Add Display Capture source
3. Settings → Output:
   - Recording Quality: High Quality, Medium File Size
   - Recording Format: MP4
   - Encoder: x264
   - Rate Control: CBR
   - Bitrate: 6000-8000 Kbps

4. Settings → Video:
   - Base Resolution: 1920x1080
   - Output Resolution: 1920x1080
   - FPS: 30

#### Option 2: QuickTime Player (macOS Only - Simple)

1. Open QuickTime Player
2. File → New Screen Recording
3. Click Options:
   - Microphone: Built-in or external mic
   - Quality: Maximum

#### Option 3: Loom (Easy & Cloud-based)

**Website:** [loom.com](https://www.loom.com/)

- Free tier: Up to 5 min videos
- Automatic cloud upload
- Built-in editing

### Terminal Setup

```bash
# Set larger font for recording
# VS Code Terminal: Cmd+, → search "terminal font size" → 16

# Or use iTerm2/Terminal preferences

# Clear terminal history
clear

# Set environment variables
export BASE_URL=https://your-app.railway.app
export WS_URL=your-app.railway.app
```

### Browser Setup

Open these tabs in order:
1. Railway Dashboard (show deployment)
2. GitHub Repository (show code)
3. Postman (for API testing)
4. Railway App URL (for live demo)

---

## Video Script

**Total Duration:** 90-120 seconds

### Introduction (0:00 - 0:15)

> "Hello! I'm demonstrating a production-ready DEX Order Execution Engine deployed on Railway. This application provides intelligent multi-DEX routing with real-time WebSocket updates for cryptocurrency trading."

**Show:** Railway dashboard with all services running (green status)

### Architecture Overview (0:15 - 0:30)

> "The system uses Node.js, TypeScript, Fastify for the API, MongoDB for data persistence, Redis with BullMQ for queue management, and WebSockets for real-time updates. It supports three trading pairs: BTC/USDT, ETH/USDT, and BTC/ETH."

**Show:**
- GitHub repository (briefly scroll through folder structure)
- README.md architecture diagram

### Live API Demo (0:30 - 0:50)

> "Let me demonstrate the API. I'll submit a market order for 0.5 BTC to USDT."

**Show:** Terminal running demo script

```bash
npm run demo
```

**Highlight:**
- System health check ✅
- Order submission
- Real-time WebSocket updates
- Status transitions: PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
- DEX selection (Meteora vs Raydium)
- Execution details (price, fee, received amount)

### Concurrent Processing (0:50 - 1:10)

> "The system handles concurrent orders efficiently. Watch as I submit multiple orders simultaneously across different trading pairs."

**Show:** Demo script concurrent section

**Highlight:**
- 3 orders submitted at once
- Parallel processing
- All orders complete in ~5 seconds
- Success statistics

### Key Features Summary (1:10 - 1:30)

> "Key features include: intelligent DEX routing that selects the best price after fees, real-time WebSocket updates for instant order tracking, concurrent processing with 10 simultaneous orders, rate limiting at 100 orders per minute, and comprehensive error handling with automatic retries."

**Show:**
- Quick tour of Postman collection
- Health endpoint showing queue metrics
- Railway logs showing successful processing

### Conclusion (1:30 - 1:45)

> "The application is fully tested with 69+ unit and integration tests, includes complete API documentation, Postman collection, and is production-ready on Railway with MongoDB and Redis. Thank you for watching!"

**Show:**
- Final Railway dashboard with metrics
- GitHub repository star count (if applicable)
- README.md with documentation

---

## Recording Steps

### Step 1: Test Run

Before recording:

```bash
# Terminal 1: Ensure server is running on Railway
curl https://your-app.railway.app/health

# Terminal 2: Test demo script
npm run demo

# Verify everything works
```

### Step 2: Prepare Windows

1. Close unnecessary applications
2. Hide desktop icons (optional)
3. Disable notifications:
   - **macOS**: System Preferences → Notifications → Do Not Disturb
   - **Windows**: Settings → System → Focus Assist → Priority Only

4. Clear terminal:
```bash
clear
```

5. Open browser tabs in order

### Step 3: Record

#### Using OBS Studio

1. Click **"Start Recording"**
2. Wait 2 seconds (breathing room for editing)
3. Follow video script
4. Wait 2 seconds at end
5. Click **"Stop Recording"**

#### Using QuickTime

1. Click record button
2. Follow video script
3. Click stop button

### Step 4: Recording Tips

**Do:**
- ✅ Speak clearly and at moderate pace
- ✅ Pause between sections (easier to edit)
- ✅ Use terminal commands visibly (don't rush)
- ✅ Highlight important outputs (cursor or mouse)
- ✅ Show Railway dashboard to prove deployment

**Don't:**
- ❌ Rush through demonstrations
- ❌ Apologize for mistakes (just re-record)
- ❌ Include sensitive information (API keys, passwords)
- ❌ Show personal information in browser

### Step 5: Multiple Takes

If you make a mistake:
- Pause, breathe, continue from that section
- Or stop and start a new recording
- Keep best take for final video

---

## Detailed Demo Script Commands

### Terminal Commands Sequence

```bash
# 1. Show you're in the project directory
pwd
# Expected: .../eterna_project

# 2. Show Railway deployment is live
curl https://your-app.railway.app/health | jq
# jq formats JSON nicely

# 3. Run the colorful demo
npm run demo

# Wait and let it run through:
# - System health check
# - Single order execution
# - Concurrent orders
# - Statistics

# 4. (Optional) Show test output
npm run test:all-pairs
```

### Browser Navigation Sequence

1. **Railway Dashboard**
   - Show all 3 services: Application, MongoDB, Redis
   - All should show green "Active" status
   - Click on Application → Show public URL
   - Click on Deployments → Show successful deployment

2. **GitHub Repository**
   - Show folder structure
   - Briefly scroll through README.md
   - Show postman/ and docs/ folders
   - Show tests/ folder

3. **Postman (Optional)**
   - Import collection
   - Send POST /api/orders/execute request
   - Show response with orderId
   - Send GET /api/orders/:orderId to see final status

---

## Post-Production

### Editing (Optional)

#### Simple Edits

Tools:
- **macOS**: iMovie (free)
- **Windows**: Windows Video Editor (free)
- **Cross-platform**: DaVinci Resolve (free)

Edits to make:
1. **Trim beginning/end**: Remove setup/teardown
2. **Cut mistakes**: Remove any errors
3. **Add titles**:
   - Opening: "DEX Order Execution Engine"
   - Closing: "GitHub: [your-repo-url]"

4. **Add captions** (optional but helpful)

#### Advanced Edits

- Background music (low volume, non-intrusive)
- Zoom/highlight important sections
- Picture-in-picture webcam (if desired)
- Annotations/arrows pointing to features

### Export Settings

**Recommended:**
- Resolution: 1920x1080 (1080p)
- Frame Rate: 30fps
- Format: MP4
- Codec: H.264
- Bitrate: 8000-10000 Kbps
- Audio: AAC, 192 Kbps

**File size:** Should be 50-150MB for 2 minutes

---

## Upload Instructions

### YouTube Upload

1. **Sign in to YouTube**
2. Click **"Create"** → **"Upload video"**
3. Select your video file

4. **Video Details:**
   - **Title**: "DEX Order Execution Engine - Multi-DEX Routing with Real-time WebSocket Updates"
   - **Description**:
```
Production-ready DEX Order Execution Engine deployed on Railway.

🚀 Features:
• Multi-DEX intelligent routing (Raydium & Meteora)
• Real-time WebSocket order updates
• Concurrent order processing (10 simultaneous)
• Multiple trading pairs: BTC/USDT, ETH/USDT, BTC/ETH
• Queue management with BullMQ & Redis
• MongoDB for persistence
• 69+ comprehensive tests

🛠️ Tech Stack:
• Node.js + TypeScript
• Fastify Web Framework
• MongoDB + Mongoose
• Redis + BullMQ
• WebSocket for real-time updates

🔗 Links:
• GitHub: [your-repo-url]
• Live Demo: [your-railway-url]
• Documentation: [your-repo-url]/blob/main/README.md

⏱️ Timestamps:
0:00 - Introduction
0:15 - Architecture Overview
0:30 - Live API Demo
0:50 - Concurrent Processing
1:10 - Key Features
1:30 - Conclusion

#DEX #Blockchain #NodeJS #TypeScript #WebSocket #API #Railway
```

5. **Thumbnail:**
   - Use first frame or create custom
   - Recommended size: 1280x720
   - Text: "DEX Order Engine" + key feature

6. **Playlist:** Create "Projects" playlist

7. **Tags:**
```
DEX, Order Execution, Trading Engine, WebSocket, Real-time, Node.js, TypeScript, MongoDB, Redis, BullMQ, Fastify, Railway, Deployment, API, Cryptocurrency, Trading
```

8. **Visibility:**
   - **Public**: Anyone can find and watch
   - **Unlisted**: Only people with link (recommended for project submission)
   - **Private**: Only you

9. Click **"Publish"**

### Alternative Platforms

#### Loom
- Upload automatically during recording
- Get shareable link immediately
- Free tier: 5 min limit

#### Vimeo
- Professional appearance
- Better privacy controls
- Free tier: 500MB/week

#### Google Drive
- Simple sharing
- No processing time
- Direct download available

---

## Video Checklist

### Before Publishing

- [ ] Video length: 1-2 minutes ✓
- [ ] Audio clear and understandable ✓
- [ ] All features demonstrated ✓
- [ ] Railway deployment shown ✓
- [ ] No sensitive information visible ✓
- [ ] Title and description complete ✓
- [ ] GitHub link included ✓
- [ ] Live URL included ✓

### After Publishing

- [ ] Video plays correctly
- [ ] Link works and is accessible
- [ ] Added to project documentation
- [ ] Shared with stakeholders

---

## Sample Video Outline

```
[0:00-0:10] Introduction
- "Hi, I'm demonstrating a DEX Order Execution Engine"
- Show Railway dashboard

[0:10-0:25] Architecture
- "Built with Node.js, TypeScript, Fastify"
- "Uses MongoDB and Redis"
- "Supports BTC/USDT, ETH/USDT, BTC/ETH"
- Show GitHub repo structure

[0:25-0:45] Single Order Demo
- Run: npm run demo
- Show system health
- Show order execution
- Highlight: PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
- Show DEX selection and pricing

[0:45-1:05] Concurrent Orders
- Demo continues with 3 simultaneous orders
- Show parallel processing
- Show completion statistics

[1:05-1:20] Features Summary
- Intelligent routing
- Real-time WebSocket updates
- Concurrent processing (10 orders)
- Rate limiting (100/min)
- Error handling & retries

[1:20-1:30] Testing & Documentation
- "69+ tests"
- Show Postman collection
- Show API documentation

[1:30-1:40] Deployment
- Show Railway dashboard with metrics
- Show MongoDB and Redis services
- Show successful deployments

[1:40-1:45] Conclusion
- "Production-ready on Railway"
- "Complete documentation available"
- "GitHub link in description"
- "Thank you!"
```

---

## Troubleshooting

### Video Issues

**Problem:** Video too large (>500MB)

**Solution:**
- Reduce resolution to 720p
- Lower bitrate to 5000 Kbps
- Use MP4 format with H.264 codec

**Problem:** Audio not clear

**Solution:**
- Record in quiet environment
- Use external microphone
- Check audio levels in OBS (aim for -12dB to -6dB)

**Problem:** Demo script fails during recording

**Solution:**
- Test multiple times before recording
- Have backup plan (use Postman instead)
- Can edit out mistakes in post-production

### YouTube Issues

**Problem:** Upload stuck at processing

**Solution:**
- Wait 10-30 minutes
- Try different browser
- Check file format is MP4 H.264

**Problem:** Video quality degraded

**Solution:**
- Upload in original quality
- Wait for HD processing (can take hours)
- Check upload bitrate was sufficient

---

## Tips for Best Results

1. **Practice**: Run through demo 2-3 times before recording
2. **Energy**: Speak with enthusiasm (but not rushed)
3. **Clarity**: Explain what you're doing as you do it
4. **Visual**: Show, don't just tell
5. **Brevity**: Respect viewer's time - keep it 90-120 seconds
6. **Professional**: Use Railway production URL, not localhost
7. **Complete**: Show full workflow from submission to confirmation
8. **Proof**: Show Railway dashboard to prove it's deployed

---

## Final Checklist

Before submitting:

- [ ] Video recorded and edited
- [ ] Uploaded to YouTube/platform
- [ ] Link is public/unlisted (accessible)
- [ ] Video demonstrates all key features
- [ ] GitHub link in description
- [ ] Railway URL in description
- [ ] Video link added to README.md
- [ ] Video link added to project submission

**Congratulations!** Your demo video is complete and ready to share! 🎉
