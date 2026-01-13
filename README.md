# Screen Recorder Web App

A modern web-based screen recorder that captures your entire screen with microphone and camera support, multiple output formats, and resolution options.

## Features

### Screen Recording
- **Full Screen Recording**: Capture your entire screen, specific window, or browser tab
- **High Resolution**: Records up to 4K resolution at 60fps
- **System Audio**: Captures system audio when available (browser support varies)
- **Pause/Resume**: Pause and resume recording without stopping
- **Live Preview**: Watch your screen while recording

### Audio
- **Microphone Selection**: Choose from available microphones
- **Microphone Toggle**: Enable/disable microphone audio
- **Audio Mixing**: Combines system audio with microphone

### Camera (Webcam)
- **Camera Selection**: Choose from available cameras
- **Camera Toggle**: Enable/disable camera recording
- **Camera Overlay**: Embed camera as picture-in-picture overlay on screen recording
- **Camera Position**: Place overlay in any corner (top-left, top-right, bottom-left, bottom-right)
- **Camera Size**: Choose overlay size (Small, Medium, Large, Extra Large)
- **Separate Recording**: Option to save camera as a separate video file instead of overlay

### Output Options
- **Multiple Formats**: Export to MP4, WebM, MOV, MKV, or AVI
- **Resolution Selection**: Choose output resolution (Original, 720p, 1080p, 1440p, 4K)
- **FFmpeg Conversion**: Server-side conversion for format and resolution changes

## Getting Started

### Prerequisites

- Node.js 18+ installed
- FFmpeg installed on your system (for format conversion)
- Modern web browser (Chrome, Edge, or Firefox recommended)

### Installation

```bash
# Install dependencies
npm install

# Start development server (runs both frontend and conversion server)
npm run dev
```

The app runs two servers:
- **Frontend**: http://localhost:5173
- **Conversion Server**: http://localhost:3001

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

1. Open the app in your browser at http://localhost:5173
2. Configure your recording settings:
   - Select microphone and toggle on/off
   - Select camera and toggle on/off
   - Choose camera position and size (if using overlay mode)
   - Or check "Save camera as separate video file" for separate recordings
   - Select output resolution and format
3. Click **"Start Recording"**
4. Choose what to share (entire screen, window, or tab)
5. Record your content (use Pause/Resume as needed)
6. Click **"Stop Recording"** when done
7. Preview your recording(s)
8. Download screen recording (and camera recording if separate)

## Settings

| Setting | Options | Description |
|---------|---------|-------------|
| Microphone | Device list + toggle | Select audio input device |
| Output Resolution | Original, 720p, 1080p, 1440p, 4K | Final video resolution |
| Output Format | MP4, WebM, MOV, MKV, AVI | Video container format |
| Camera | Device list + toggle | Select video input device |
| Camera Position | Top-Left, Top-Right, Bottom-Left, Bottom-Right | Overlay position |
| Camera Size | Small (15%), Medium (20%), Large (25%), Extra Large (30%) | Overlay size relative to screen |
| Separate Recording | Checkbox | Save camera as separate file |

## Browser Support

- **Chrome/Edge**: Full support including system audio capture
- **Firefox**: Screen capture supported, system audio may be limited
- **Safari**: Limited support for screen capture

## Technical Details

- **Frontend**: React + Vite + TailwindCSS + Lucide Icons
- **Backend**: Express.js server for FFmpeg conversion
- **Screen Capture**: Uses the Screen Capture API (`getDisplayMedia`)
- **Recording**: MediaRecorder API with VP9/H.264 codecs
- **Camera Compositing**: HTML5 Canvas for real-time overlay
- **Video Bitrate**: Up to 8 Mbps for screen, 4 Mbps for camera
- **Audio**: 48kHz sample rate with echo cancellation and noise suppression

## Project Structure

```
screen_recorder2/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind styles
├── server/
│   └── index.js         # Express server for FFmpeg conversion
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## License

MIT
