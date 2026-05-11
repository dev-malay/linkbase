import app from './app'
import { logger } from './utils/logger'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info(`🚀 LINKBASE API Server running on port ${PORT}`)
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`💼 Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`)
  logger.info(`✨ Visitor Enrichment: ${process.env.IPINFO_API_KEY ? 'Enabled' : 'Free tier (ip-api.com)'}`)
})
