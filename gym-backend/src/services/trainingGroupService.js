import mongoose from 'mongoose'
import TrainingGroup from '../models/TrainingGroup.js'

export const createGroup = async ({ name, goal, trainerId, zoneId, maxCapacity, description }) => {
  return TrainingGroup.create({
    name, goal: goal || '', trainerId: trainerId || null,
    zoneId: zoneId || null, maxCapacity: maxCapacity || 15,
    description: description || '',
  })
}

export const updateGroup = async ({ groupId, data }) => {
  return TrainingGroup.findByIdAndUpdate(groupId, data, { new: true })
}

export const getAllGroups = async ({ status, page = 1, limit = 20 }) => {
  const filter = {}
  if (status) filter.status = status
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    TrainingGroup.find(filter)
      .populate('trainerId', 'name fullName email phone avatar')
      .populate('zoneId', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TrainingGroup.countDocuments(filter),
  ])
  return {
    groups: items,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}

export const getGroupById = async (groupId) => {
  return TrainingGroup.findById(groupId)
    .populate('trainerId', 'name fullName email phone avatar')
    .populate('zoneId', 'name type floorId')
    .populate('members.memberId', 'name fullName email phone avatar memberCode')
}

export const addMember = async ({ groupId, memberId }) => {
  const group = await TrainingGroup.findById(groupId)
  if (!group) throw new Error('Không tìm thấy nhóm tập')
  if (group.members.filter((m) => m.status === 'active').length >= group.maxCapacity) {
    throw new Error('Nhóm đã đủ sĩ số')
  }
  const exists = group.members.find((m) => String(m.memberId) === String(memberId) && m.status === 'active')
  if (exists) return group
  group.members.push({ memberId, status: 'active', joinedAt: new Date() })
  return group.save()
}

export const removeMember = async ({ groupId, memberId }) => {
  const group = await TrainingGroup.findById(groupId)
  if (!group) throw new Error('Không tìm thấy nhóm tập')
  const member = group.members.find((m) => String(m.memberId) === String(memberId) && m.status === 'active')
  if (!member) return group
  member.status = 'cancelled'
  member.leftAt = new Date()
  return group.save()
}

export const archiveGroup = async (groupId) => {
  return TrainingGroup.findByIdAndUpdate(groupId, { status: 'archived' }, { new: true })
}
