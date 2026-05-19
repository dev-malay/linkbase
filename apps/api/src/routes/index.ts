import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import linkRoutes from './link.routes'
import visitorRoutes from './visitor.routes'
import analyticsRoutes from './analytics.routes'
import profileRoutes from './profile.routes'
import aiRoutes from './ai.routes'

const router = Router()

// Public access  routes
router.use('/auth', authRoutes)
router.use('/profile', profileRoutes) // Public profile pages

// Protected routes
router.use('/users', userRoutes)
router.use('/links', linkRoutes)
router.use('/visitors', visitorRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/ai', aiRoutes)

export default router
