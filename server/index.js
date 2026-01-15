import express from 'express'
import multer from 'multer'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Create uploads and output directories
const uploadsDir = path.join(__dirname, 'uploads')
const outputDir = path.join(__dirname, 'output')

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `recording-${Date.now()}.webm`)
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10GB limit
})

// Format configurations for FFmpeg
const formatConfigs = {
  mp4: {
    extension: 'mp4',
    args: (input, output, resolution) => [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      ...getResolutionArgs(resolution),
      '-movflags', '+faststart',
      '-y',
      output
    ]
  },
  mov: {
    extension: 'mov',
    args: (input, output, resolution) => [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      ...getResolutionArgs(resolution),
      '-y',
      output
    ]
  },
  avi: {
    extension: 'avi',
    args: (input, output, resolution) => [
      '-i', input,
      '-c:v', 'libxvid',
      '-q:v', '3',
      '-c:a', 'mp3',
      '-b:a', '192k',
      ...getResolutionArgs(resolution),
      '-y',
      output
    ]
  },
  webm: {
    extension: 'webm',
    args: (input, output, resolution) => [
      '-i', input,
      '-c:v', 'libvpx-vp9',
      '-crf', '20',
      '-b:v', '0',
      '-c:a', 'libopus',
      '-b:a', '192k',
      ...getResolutionArgs(resolution),
      '-y',
      output
    ]
  },
  mkv: {
    extension: 'mkv',
    args: (input, output, resolution) => [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      ...getResolutionArgs(resolution),
      '-y',
      output
    ]
  }
}

// Resolution configurations
const resolutions = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
  'original': null
}

function getResolutionArgs(resolution) {
  if (!resolution || resolution === 'original' || !resolutions[resolution]) {
    return []
  }
  const { width, height } = resolutions[resolution]
  return ['-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`]
}

// Convert video endpoint
app.post('/convert', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' })
  }

  const { format = 'mp4', resolution = 'original' } = req.body
  const config = formatConfigs[format]
  
  if (!config) {
    fs.unlinkSync(req.file.path)
    return res.status(400).json({ error: `Unsupported format: ${format}` })
  }

  const inputPath = req.file.path
  const outputFilename = `recording-${Date.now()}.${config.extension}`
  const outputPath = path.join(outputDir, outputFilename)

  console.log(`Converting ${inputPath} to ${format} at ${resolution}...`)

  const ffmpegArgs = config.args(inputPath, outputPath, resolution)
  const ffmpeg = spawn('ffmpeg', ffmpegArgs)

  let stderr = ''

  ffmpeg.stderr.on('data', (data) => {
    stderr += data.toString()
    // Extract progress info
    const timeMatch = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/)
    if (timeMatch) {
      console.log(`Progress: ${timeMatch[1]}`)
    }
  })

  ffmpeg.on('close', (code) => {
    // Clean up input file
    fs.unlinkSync(inputPath)

    if (code !== 0) {
      console.error('FFmpeg error:', stderr)
      return res.status(500).json({ error: 'Conversion failed', details: stderr })
    }

    console.log(`Conversion complete: ${outputPath}`)
    
    // Send the converted file
    res.download(outputPath, outputFilename, (err) => {
      // Clean up output file after download
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
      }
      if (err) {
        console.error('Download error:', err)
      }
    })
  })

  ffmpeg.on('error', (err) => {
    fs.unlinkSync(inputPath)
    console.error('FFmpeg spawn error:', err)
    res.status(500).json({ error: 'Failed to start FFmpeg', details: err.message })
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', formats: Object.keys(formatConfigs), resolutions: Object.keys(resolutions) })
})

app.listen(PORT, () => {
  console.log(`Conversion server running on http://localhost:${PORT}`)
})
