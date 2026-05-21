import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import imagesRouter from './routes/images.js'
import generateRouter from './routes/generate.js'
import editRouter from './routes/edit.js'
import videoRouter from './routes/video.js'
import workflowRouter from './routes/workflow.js'
import resourcesRouter from './routes/resources.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3456

app.use(cors())
app.use(express.json())

// Request logger
app.use((req, res, next) => {
  const start = Date.now()
  const { method, url } = req
  res.on('finish', () => {
    const ms = Date.now() - start
    console.log(`${method} ${url} ${res.statusCode} ${ms}ms`)
  })
  next()
})

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')))

// API routes
app.use('/api/images', imagesRouter)
app.use('/api/generate', generateRouter)
app.use('/api/edit', editRouter)
app.use('/api/video', videoRouter)
app.use('/api/workflow', workflowRouter)
app.use('/api/resources', resourcesRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), pid: process.pid })
})

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Server port ${PORT} is already in use. Stop the existing process or set PORT to another value.`)
    process.exit(1)
  }
  throw error
})
