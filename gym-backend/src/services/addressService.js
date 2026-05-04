import mongoose from 'mongoose'
import Address from '../models/Address.js'
import AppError from '../utils/appError.js'

export const getAddressesByUser = async (userId) => {
    return Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 })
}

export const getDefaultAddress = async (userId) => {
    return Address.findOne({ userId, isDefault: true })
}

export const createAddress = async ({ userId, fullName, phone, street, ward, district, city, isDefault = false }) => {
    if (!userId) throw new AppError('User ID is required', 400)
    if (!fullName || !phone || !street || !district || !city) {
        throw new AppError('Địa chỉ phải có tên, số điện thoại, street, district và city', 400)
    }

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
        if (isDefault) {
            await Address.updateMany({ userId, isDefault: true }, { isDefault: false }, { session })
        } else {
            const existingDefault = await getDefaultAddress(userId)
            if (!existingDefault) {
                isDefault = true
            }
        }

        const address = await Address.create(
            [
                {
                    userId,
                    fullName,
                    phone,
                    street,
                    ward,
                    district,
                    city,
                    isDefault,
                },
            ],
            { session },
        )

        await session.commitTransaction()
        return address[0]
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const updateAddress = async ({ userId, addressId, data }) => {
    if (!userId) throw new AppError('User ID is required', 400)
    if (!addressId) throw new AppError('Address ID is required', 400)

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
        if (data.isDefault) {
            await Address.updateMany({ userId, isDefault: true }, { isDefault: false }, { session })
        }

        const updated = await Address.findOneAndUpdate({ _id: addressId, userId }, { $set: data }, { new: true, session })
        if (!updated) {
            throw new AppError('Địa chỉ không tồn tại hoặc không có quyền', 404)
        }

        await session.commitTransaction()
        return updated
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const deleteAddress = async ({ userId, addressId }) => {
    if (!userId) throw new AppError('User ID is required', 400)
    if (!addressId) throw new AppError('Address ID is required', 400)

    const address = await Address.findOneAndDelete({ _id: addressId, userId })
    if (!address) {
        throw new AppError('Địa chỉ không tồn tại hoặc không có quyền', 404)
    }

    if (address.isDefault) {
        const nextAddress = await Address.findOne({ userId }).sort({ updatedAt: -1 })
        if (nextAddress) {
            nextAddress.isDefault = true
            await nextAddress.save()
        }
    }

    return address
}

export const setDefaultAddress = async ({ userId, addressId }) => {
    if (!userId) throw new AppError('User ID is required', 400)
    if (!addressId) throw new AppError('Address ID is required', 400)

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
        await Address.updateMany({ userId, isDefault: true }, { isDefault: false }, { session })
        const updated = await Address.findOneAndUpdate({ _id: addressId, userId }, { isDefault: true }, { new: true, session })
        if (!updated) {
            throw new AppError('Địa chỉ không tồn tại hoặc không có quyền', 404)
        }
        await session.commitTransaction()
        return updated
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}
