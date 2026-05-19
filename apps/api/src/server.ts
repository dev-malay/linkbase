import app from './app'
import { logger } from './utils/logger'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info(`LINKBASE api Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`)
  logger.info(` visitor Enrichment: ${process.env.IPINFO_API_KEY ? 'Enabled' : 'Free tier (ip-api.com)'}`)
})
