/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db/init.js'
import authRoutes from './routes/auth.js'
import equipmentRoutes from './routes/equipment.js'
import reservationRoutes from './routes/reservation.js'
import usageRoutes from './routes/usage.js'
import trainingRoutes from './routes/training.js'
import statisticsRoutes from './routes/statistics.js'
import maintenanceRoutes from './routes/maintenance.js'
import borrowRoutes from './routes/borrow.js'
import projectRoutes from './routes/project.js'
import consumableRoutes from './routes/consumable.js'
import waitlistRoutes from './routes/waitlist.js'
import reportRoutes from './routes/report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

initDatabase()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/reservations', reservationRoutes)
app.use('/api/usage', usageRoutes)
app.use('/api/trainings', trainingRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/maintenance', maintenanceRoutes)
app.use('/api/borrows', borrowRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/consumables', consumableRoutes)
app.use('/api/waitlist', waitlistRoutes)
app.use('/api/reports', reportRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
