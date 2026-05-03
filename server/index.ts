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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
