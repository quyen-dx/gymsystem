import * as trainerScheduleService from '../services/trainerScheduleService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

export const setSchedule = async (req, res) => {
  try {
    const { schedules } = req.body
    const trainerId = req.params.trainerId || req.user._id
    const result = await trainerScheduleService.setSchedule({ trainerId, schedules: schedules || [] })
    createNotification({
      receiverId: trainerId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.PT_SCHEDULE_CHANGED,
      title: 'Lịch làm việc đã được cập nhật',
      content: 'Lịch làm việc của bạn đã được Admin cập nhật.',
      relatedId: trainerId,
      relatedType: 'TrainerSchedule',
      redirectUrl: '/pt/schedule',
      createdBy: 'Admin',
    }).catch(err => console.error('Notify trainer schedule failed:', err.message))
    res.json({ message: 'Đã cập nhật lịch làm việc', schedules: result })
  } catch (error) {
    res.status(409).json({ message: error.message })
  }
}

export const getMySchedule = async (req, res) => {
  try {
    const result = await trainerScheduleService.getTrainerSchedule(req.user._id)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getTrainerSchedule = async (req, res) => {
  try {
    const result = await trainerScheduleService.getTrainerSchedule(req.params.trainerId)
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAllSchedules = async (req, res) => {
  try {
    const result = await trainerScheduleService.getAllSchedules({ trainerId: req.query.trainerId, page: req.query.page })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getAvailableTrainers = async (req, res) => {
  try {
    const { dayOfWeek, shift } = req.query
    const trainers = await trainerScheduleService.getAvailableTrainers({ dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : undefined, shift })
    res.json({ trainers })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
