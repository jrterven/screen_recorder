import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Monitor, 
  Mic, 
  MicOff, 
  Circle, 
  Square, 
  Download, 
  Settings,
  Video,
  Pause,
  Play,
  Loader2,
  FileVideo,
  Camera,
  CameraOff
} from 'lucide-react'

const CAMERA_POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' }
]

const CAMERA_SIZES = [
  { value: 'small', label: 'Small', percent: 0.15 },
  { value: 'medium', label: 'Medium', percent: 0.20 },
  { value: 'large', label: 'Large', percent: 0.25 },
  { value: 'xlarge', label: 'Extra Large', percent: 0.30 }
]

const RESOLUTIONS = [
  { value: 'original', label: 'Original', width: null, height: null },
  { value: '720p', label: '720p (HD)', width: 1280, height: 720 },
  { value: '1080p', label: '1080p (Full HD)', width: 1920, height: 1080 },
  { value: '1440p', label: '1440p (2K)', width: 2560, height: 1440 },
  { value: '4k', label: '4K (Ultra HD)', width: 3840, height: 2160 }
]

const OUTPUT_FORMATS = [
  { value: 'mp4', label: 'MP4', description: 'Best compatibility' },
  { value: 'webm', label: 'WebM', description: 'Web optimized' },
  { value: 'mov', label: 'MOV', description: 'Apple devices' },
  { value: 'mkv', label: 'MKV', description: 'High quality' },
  { value: 'avi', label: 'AVI', description: 'Legacy format' }
]

const SERVER_URL = 'http://localhost:3001'

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [microphones, setMicrophones] = useState([])
  const [selectedMic, setSelectedMic] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState(null)
  const [screenStream, setScreenStream] = useState(null)
  const [selectedResolution, setSelectedResolution] = useState('1080p')
  const [outputFormat, setOutputFormat] = useState('mp4')
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState('')
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraPosition, setCameraPosition] = useState('bottom-right')
  const [cameraSize, setCameraSize] = useState('medium')
  const [separateCameraRecording, setSeparateCameraRecording] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraRecordedBlob, setCameraRecordedBlob] = useState(null)
  const [cameraRecordedUrl, setCameraRecordedUrl] = useState(null)

  const mediaRecorderRef = useRef(null)
  const cameraRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const cameraChunksRef = useRef([])
  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const recordedVideoRef = useRef(null)
  const cameraPreviewRef = useRef(null)
  const canvasRef = useRef(null)

  // Fetch available microphones and cameras
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission first to get labeled devices
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        setMicrophones(audioInputs)
        if (audioInputs.length > 0) {
          setSelectedMic(audioInputs[0].deviceId)
        }

        const videoInputs = devices.filter(device => device.kind === 'videoinput')
        setCameras(videoInputs)
        if (videoInputs.length > 0) {
          setSelectedCamera(videoInputs[0].deviceId)
        }
      } catch (err) {
        console.error('Error getting devices:', err)
        setError('Unable to access media devices. Please check permissions.')
      }
    }
    getDevices()
  }, [])

  // Start/stop camera preview when enabled/disabled or camera changes
  useEffect(() => {
    async function toggleCamera() {
      if (cameraEnabled && selectedCamera) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedCamera },
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          })
          setCameraStream(stream)
          if (cameraPreviewRef.current) {
            cameraPreviewRef.current.srcObject = stream
          }
        } catch (err) {
          console.error('Error starting camera:', err)
          setError('Unable to access camera.')
          setCameraEnabled(false)
        }
      } else {
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop())
          setCameraStream(null)
        }
        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = null
        }
      }
    }
    toggleCamera()

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraEnabled, selectedCamera])

  // Timer for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording, isPaused])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      setError(null)
      chunksRef.current = []

      // Request screen capture with high resolution
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 60, max: 60 }
        },
        audio: true // System audio
      })

      setScreenStream(displayStream)

      // Get screen video track settings
      const screenTrack = displayStream.getVideoTracks()[0]
      const screenSettings = screenTrack.getSettings()
      const screenWidth = screenSettings.width || 1920
      const screenHeight = screenSettings.height || 1080

      let finalVideoStream = displayStream
      let drawIntervalId = null

      // If camera is enabled and NOT separate recording, composite screen + camera using canvas
      if (cameraEnabled && cameraStream && !separateCameraRecording) {
        const canvas = canvasRef.current
        canvas.width = screenWidth
        canvas.height = screenHeight
        const ctx = canvas.getContext('2d')

        // Create video elements for compositing
        const screenVideo = document.createElement('video')
        screenVideo.srcObject = displayStream
        screenVideo.muted = true
        screenVideo.playsInline = true
        screenVideo.autoplay = true

        const cameraVideo = document.createElement('video')
        cameraVideo.srcObject = cameraStream
        cameraVideo.muted = true
        cameraVideo.playsInline = true
        cameraVideo.autoplay = true

        // Wait for both videos to be ready
        await Promise.all([
          new Promise((resolve) => {
            screenVideo.onloadedmetadata = () => {
              screenVideo.play().then(resolve).catch(resolve)
            }
            if (screenVideo.readyState >= 2) {
              screenVideo.play().then(resolve).catch(resolve)
            }
          }),
          new Promise((resolve) => {
            cameraVideo.onloadedmetadata = () => {
              cameraVideo.play().then(resolve).catch(resolve)
            }
            if (cameraVideo.readyState >= 2) {
              cameraVideo.play().then(resolve).catch(resolve)
            }
          })
        ])

        // Camera overlay size based on selected size
        const sizeConfig = CAMERA_SIZES.find(s => s.value === cameraSize) || CAMERA_SIZES[1]
        const camWidth = Math.round(screenWidth * sizeConfig.percent)
        const camHeight = Math.round(camWidth * 0.75) // 4:3 aspect ratio
        const padding = 20

        // Calculate camera position
        const getPosition = () => {
          switch (cameraPosition) {
            case 'top-left':
              return { x: padding, y: padding }
            case 'top-right':
              return { x: screenWidth - camWidth - padding, y: padding }
            case 'bottom-left':
              return { x: padding, y: screenHeight - camHeight - padding }
            case 'bottom-right':
            default:
              return { x: screenWidth - camWidth - padding, y: screenHeight - camHeight - padding }
          }
        }

        // Draw composite frame (using setInterval instead of requestAnimationFrame
        // because requestAnimationFrame pauses when tab loses focus)
        const drawFrame = () => {
          ctx.drawImage(screenVideo, 0, 0, screenWidth, screenHeight)
          
          // Draw camera with rounded corners
          const pos = getPosition()
          const radius = 12
          
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(pos.x + radius, pos.y)
          ctx.lineTo(pos.x + camWidth - radius, pos.y)
          ctx.quadraticCurveTo(pos.x + camWidth, pos.y, pos.x + camWidth, pos.y + radius)
          ctx.lineTo(pos.x + camWidth, pos.y + camHeight - radius)
          ctx.quadraticCurveTo(pos.x + camWidth, pos.y + camHeight, pos.x + camWidth - radius, pos.y + camHeight)
          ctx.lineTo(pos.x + radius, pos.y + camHeight)
          ctx.quadraticCurveTo(pos.x, pos.y + camHeight, pos.x, pos.y + camHeight - radius)
          ctx.lineTo(pos.x, pos.y + radius)
          ctx.quadraticCurveTo(pos.x, pos.y, pos.x + radius, pos.y)
          ctx.closePath()
          ctx.clip()
          
          // Draw camera (mirror horizontally for natural feel)
          ctx.translate(pos.x + camWidth, pos.y)
          ctx.scale(-1, 1)
          ctx.drawImage(cameraVideo, 0, 0, camWidth, camHeight)
          ctx.restore()

          // Draw border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(pos.x + radius, pos.y)
          ctx.lineTo(pos.x + camWidth - radius, pos.y)
          ctx.quadraticCurveTo(pos.x + camWidth, pos.y, pos.x + camWidth, pos.y + radius)
          ctx.lineTo(pos.x + camWidth, pos.y + camHeight - radius)
          ctx.quadraticCurveTo(pos.x + camWidth, pos.y + camHeight, pos.x + camWidth - radius, pos.y + camHeight)
          ctx.lineTo(pos.x + radius, pos.y + camHeight)
          ctx.quadraticCurveTo(pos.x, pos.y + camHeight, pos.x, pos.y + camHeight - radius)
          ctx.lineTo(pos.x, pos.y + radius)
          ctx.quadraticCurveTo(pos.x, pos.y, pos.x + radius, pos.y)
          ctx.closePath()
          ctx.stroke()
        }

        // Start drawing at 30fps using setInterval (works in background)
        drawIntervalId = setInterval(drawFrame, 1000 / 30)

        // Get canvas stream
        finalVideoStream = canvas.captureStream(30)
      }

      // Show preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = (cameraEnabled && cameraStream && !separateCameraRecording) ? canvasRef.current.captureStream(30) : displayStream
      }

      let combinedStream = finalVideoStream
      let micAudioStream = null

      // Get microphone audio if enabled (used for both screen and camera recordings)
      if (micEnabled && selectedMic) {
        try {
          micAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: selectedMic },
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000
            }
          })
        } catch (audioErr) {
          console.error('Error getting microphone:', audioErr)
        }
      }

      // Start separate camera recording if enabled (with audio)
      if (cameraEnabled && cameraStream && separateCameraRecording) {
        cameraChunksRef.current = []
        const cameraMimeType = getSupportedMimeType()
        
        // Combine camera video with microphone audio
        let cameraWithAudio = cameraStream
        if (micAudioStream) {
          cameraWithAudio = new MediaStream([
            ...cameraStream.getVideoTracks(),
            ...micAudioStream.getAudioTracks()
          ])
        }
        
        const cameraRecorder = new MediaRecorder(cameraWithAudio, {
          mimeType: cameraMimeType,
          videoBitsPerSecond: 4000000 // 4 Mbps for camera
        })
        
        cameraRecorderRef.current = cameraRecorder
        
        cameraRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            cameraChunksRef.current.push(event.data)
          }
        }
        
        cameraRecorder.onstop = () => {
          const blob = new Blob(cameraChunksRef.current, { type: cameraMimeType })
          setCameraRecordedBlob(blob)
          const url = URL.createObjectURL(blob)
          setCameraRecordedUrl(url)
        }
        
        cameraRecorder.start(1000)
      }

      // Add microphone audio to screen recording if enabled
      if (micAudioStream) {
        try {
          // Combine screen (with system audio) and microphone
          const audioContext = new AudioContext()
          const destination = audioContext.createMediaStreamDestination()

          // Add screen audio tracks if present
          displayStream.getAudioTracks().forEach(track => {
            const source = audioContext.createMediaStreamSource(new MediaStream([track]))
            source.connect(destination)
          })

          // Add microphone audio
          const micSource = audioContext.createMediaStreamSource(micAudioStream)
          micSource.connect(destination)

          // Combine video with mixed audio
          combinedStream = new MediaStream([
            ...finalVideoStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ])
        } catch (audioErr) {
          console.error('Error adding microphone:', audioErr)
          // Continue with just screen capture
        }
      }

      // Configure MediaRecorder for high quality MP4-compatible output
      const mimeType = getSupportedMimeType()
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps for high quality
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Clear drawing interval if camera was enabled
        if (drawIntervalId) {
          clearInterval(drawIntervalId)
        }

        const mimeType = mediaRecorder.mimeType
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setRecordedBlob(blob)
        const url = URL.createObjectURL(blob)
        setRecordedUrl(url)
        
        // Stop all tracks
        displayStream.getTracks().forEach(track => track.stop())
        setScreenStream(null)
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null
        }
      }

      // Handle when user stops sharing via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        if (isRecording) {
          stopRecording()
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingTime(0)
      setRecordedBlob(null)
      setRecordedUrl(null)
      setCameraRecordedBlob(null)
      setCameraRecordedUrl(null)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing was denied. Please allow screen capture to record.')
      } else {
        setError(`Failed to start recording: ${err.message}`)
      }
    }
  }

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ]
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'video/webm'
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') {
      cameraRecorderRef.current.stop()
    }
    setIsRecording(false)
    setIsPaused(false)
  }, [])

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
    }
    if (cameraRecorderRef.current && cameraRecorderRef.current.state === 'recording') {
      cameraRecorderRef.current.pause()
    }
    setIsPaused(true)
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
    }
    if (cameraRecorderRef.current && cameraRecorderRef.current.state === 'paused') {
      cameraRecorderRef.current.resume()
    }
    setIsPaused(false)
  }

  const downloadRecording = async () => {
    if (!recordedBlob) return

    // If format is webm and resolution is original, download directly
    if (outputFormat === 'webm' && selectedResolution === 'original') {
      const a = document.createElement('a')
      a.href = recordedUrl
      a.download = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // Otherwise, convert via server
    setIsConverting(true)
    setConversionProgress('Uploading recording...')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', recordedBlob, 'recording.webm')
      formData.append('format', outputFormat)
      formData.append('resolution', selectedResolution)

      setConversionProgress(`Converting to ${outputFormat.toUpperCase()}...`)

      const response = await fetch(`${SERVER_URL}/convert`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Conversion failed')
      }

      // Get the converted file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.${outputFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(url)
      setConversionProgress('')
    } catch (err) {
      console.error('Conversion error:', err)
      setError(`Conversion failed: ${err.message}. Make sure the server is running.`)
    } finally {
      setIsConverting(false)
    }
  }

  const downloadCameraRecording = async () => {
    if (!cameraRecordedBlob) return

    // If format is webm and resolution is original, download directly
    if (outputFormat === 'webm' && selectedResolution === 'original') {
      const a = document.createElement('a')
      a.href = cameraRecordedUrl
      a.download = `camera-recording-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // Otherwise, convert via server
    setIsConverting(true)
    setConversionProgress('Uploading camera recording...')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', cameraRecordedBlob, 'camera-recording.webm')
      formData.append('format', outputFormat)
      formData.append('resolution', selectedResolution)

      setConversionProgress(`Converting camera to ${outputFormat.toUpperCase()}...`)

      const response = await fetch(`${SERVER_URL}/convert`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Conversion failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `camera-recording-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.${outputFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(url)
      setConversionProgress('')
    } catch (err) {
      console.error('Camera conversion error:', err)
      setError(`Camera conversion failed: ${err.message}. Make sure the server is running.`)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Video className="w-10 h-10 text-red-500" />
            <h1 className="text-4xl font-bold text-white">Screen Recorder</h1>
          </div>
          <p className="text-gray-400">Record your screen with audio in high resolution</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Hidden canvas for compositing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Main Content */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 shadow-2xl border border-slate-700">
          {/* Preview Area */}
          {/* Show side-by-side when both screen and camera recordings exist */}
          {recordedUrl && cameraRecordedUrl && !isRecording ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={recordedVideoRef}
                  src={recordedUrl}
                  controls
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-xs px-2 py-1 rounded">
                  Screen Recording
                </div>
              </div>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  src={cameraRecordedUrl}
                  controls
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-purple-500/80 text-white text-xs px-2 py-1 rounded">
                  Camera Recording
                </div>
              </div>
            </div>
          ) : (
          <div className="relative bg-black rounded-xl overflow-hidden mb-6 aspect-video">
            {isRecording ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            ) : recordedUrl ? (
              <video
                ref={recordedVideoRef}
                src={recordedUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <Monitor className="w-20 h-20 mb-4" />
                <p className="text-lg">Click "Start Recording" to capture your screen</p>
              </div>
            )}

            {/* Camera Preview Overlay (when not recording but camera enabled and not separate) */}
            {!isRecording && !recordedUrl && cameraEnabled && cameraStream && !separateCameraRecording && (
              <div 
                className={`absolute rounded-lg overflow-hidden border-2 border-white/30 shadow-lg ${
                  cameraPosition === 'top-left' ? 'top-4 left-4' :
                  cameraPosition === 'top-right' ? 'top-4 right-4' :
                  cameraPosition === 'bottom-left' ? 'bottom-4 left-4' :
                  'bottom-4 right-4'
                }`}
                style={{
                  width: cameraSize === 'small' ? '100px' : cameraSize === 'medium' ? '128px' : cameraSize === 'large' ? '160px' : '192px',
                  height: cameraSize === 'small' ? '75px' : cameraSize === 'medium' ? '96px' : cameraSize === 'large' ? '120px' : '144px'
                }}
              >
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
            )}

            {/* Camera Preview (when separate recording enabled) */}
            {!isRecording && !recordedUrl && cameraEnabled && cameraStream && separateCameraRecording && (
              <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-purple-500/50 shadow-lg">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-1 left-1 bg-purple-500/80 text-white text-xs px-1 rounded">
                  Separate
                </div>
              </div>
            )}

            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 px-3 py-2 rounded-full">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-white font-mono">{formatTime(recordingTime)}</span>
                {isPaused && <span className="text-yellow-500 text-sm">(Paused)</span>}
              </div>
            )}
          </div>
          )}

          {/* Settings Panel */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-gray-400" />
              <h2 className="text-white font-semibold">Recording Settings</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Microphone Selection */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Microphone</label>
                <div className="flex gap-2">
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    disabled={isRecording}
                    className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    disabled={isRecording}
                    className={`p-2 rounded-lg border transition-colors ${
                      micEnabled 
                        ? 'bg-green-500/20 border-green-500 text-green-400' 
                        : 'bg-slate-800 border-slate-600 text-gray-400'
                    } disabled:opacity-50`}
                    title={micEnabled ? 'Microphone enabled' : 'Microphone disabled'}
                  >
                    {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Output Resolution */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Output Resolution</label>
                <select
                  value={selectedResolution}
                  onChange={(e) => setSelectedResolution(e.target.value)}
                  disabled={isRecording || isConverting}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {RESOLUTIONS.map((res) => (
                    <option key={res.value} value={res.value}>
                      {res.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Format */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  disabled={isRecording || isConverting}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label} - {fmt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Selection */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Camera</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    disabled={isRecording}
                    className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    {cameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setCameraEnabled(!cameraEnabled)}
                    disabled={isRecording}
                    className={`p-2 rounded-lg border transition-colors ${
                      cameraEnabled 
                        ? 'bg-green-500/20 border-green-500 text-green-400' 
                        : 'bg-slate-800 border-slate-600 text-gray-400'
                    } disabled:opacity-50`}
                    title={cameraEnabled ? 'Camera enabled' : 'Camera disabled'}
                  >
                    {cameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Camera Position */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Camera Position</label>
                <select
                  value={cameraPosition}
                  onChange={(e) => setCameraPosition(e.target.value)}
                  disabled={isRecording || !cameraEnabled || separateCameraRecording}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {CAMERA_POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Size */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Camera Size</label>
                <select
                  value={cameraSize}
                  onChange={(e) => setCameraSize(e.target.value)}
                  disabled={isRecording || !cameraEnabled || separateCameraRecording}
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {CAMERA_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Separate Camera Recording */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={separateCameraRecording}
                    onChange={(e) => setSeparateCameraRecording(e.target.checked)}
                    disabled={isRecording || !cameraEnabled}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 disabled:opacity-50"
                  />
                  <span className={`text-sm ${!cameraEnabled ? 'text-gray-500' : 'text-gray-300'}`}>
                    Save camera as separate video file (instead of overlay)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-semibold transition-colors shadow-lg shadow-red-500/30"
              >
                <Circle className="w-5 h-5 fill-current" />
                Start Recording
              </button>
            ) : (
              <>
                {!isPaused ? (
                  <button
                    onClick={pauseRecording}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-full font-semibold transition-colors"
                  >
                    <Pause className="w-5 h-5" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    Resume
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Stop Recording
                </button>
              </>
            )}

            {recordedBlob && !isRecording && (
              <button
                onClick={downloadRecording}
                disabled={isConverting}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-semibold transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {conversionProgress || 'Converting...'}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download Screen as {outputFormat.toUpperCase()}
                  </>
                )}
              </button>
            )}

            {cameraRecordedBlob && !isRecording && (
              <button
                onClick={downloadCameraRecording}
                disabled={isConverting}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-8 py-3 rounded-full font-semibold transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {conversionProgress || 'Converting...'}
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Download Camera as {outputFormat.toUpperCase()}
                  </>
                )}
              </button>
            )}
          </div>

          {/* File Info */}
          {recordedBlob && !isRecording && (
            <div className="mt-6 text-center text-gray-400 text-sm">
              <p>
                Screen recording: {(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB
                {cameraRecordedBlob && (
                  <>
                    <span className="mx-2">•</span>
                    Camera recording: {(cameraRecordedBlob.size / (1024 * 1024)).toFixed(2)} MB
                  </>
                )}
              </p>
              <p className="mt-1">
                Output: {outputFormat.toUpperCase()} @ {selectedResolution === 'original' ? 'Original' : selectedResolution}
              </p>
              {(outputFormat !== 'webm' || selectedResolution !== 'original') && (
                <p className="mt-1 text-gray-500">
                  Videos will be converted using FFmpeg before download
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Screen capture uses your browser's native APIs</p>
          <p>You can choose to share your entire screen, a window, or a browser tab</p>
        </div>
      </div>
    </div>
  )
}

export default App
