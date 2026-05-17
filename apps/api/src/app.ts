import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'

config()

import { captureVisitorContext } from './middleware/visitor-enrichment'
import { errorMiddleware } from './middleware/error.middleware'
import { authenticate } from './middleware/auth.middleware'
import apiRoutes from './routes'

const app: Express = express()

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(captureVisitorContext)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkbase-api',
  })
})


app.use('/api', apiRoutes)


app.use(errorMiddleware)

export default app
