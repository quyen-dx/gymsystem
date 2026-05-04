import {
    createAddress,
    deleteAddress,
    getAddressesByUser,
    getDefaultAddress,
    setDefaultAddress,
    updateAddress,
} from '../services/addressService.js'
import AppError from '../utils/appError.js'

export const getMyAddresses = async (req, res, next) => {
    try {
        const addresses = await getAddressesByUser(req.user._id)
        return res.json({ success: true, data: addresses })
    } catch (error) {
        next(error)
    }
}

export const createMyAddress = async (req, res, next) => {
    try {
        const { fullName, phone, street, ward, district, city, isDefault } = req.body
        const address = await createAddress({
            userId: req.user._id,
            fullName,
            phone,
            street,
            ward,
            district,
            city,
            isDefault: Boolean(isDefault),
        })
        return res.status(201).json({ success: true, data: address })
    } catch (error) {
        next(error)
    }
}

export const updateMyAddress = async (req, res, next) => {
    try {
        const address = await updateAddress({ userId: req.user._id, addressId: req.params.id, data: req.body })
        return res.json({ success: true, data: address })
    } catch (error) {
        next(error)
    }
}

export const deleteMyAddress = async (req, res, next) => {
    try {
        const address = await deleteAddress({ userId: req.user._id, addressId: req.params.id })
        return res.json({ success: true, data: address })
    } catch (error) {
        next(error)
    }
}

export const setDefaultMyAddress = async (req, res, next) => {
    try {
        const address = await setDefaultAddress({ userId: req.user._id, addressId: req.params.id })
        return res.json({ success: true, data: address })
    } catch (error) {
        next(error)
    }
}

export const getMyDefaultAddress = async (req, res, next) => {
    try {
        const address = await getDefaultAddress(req.user._id)
        if (!address) {
            throw new AppError('Không tìm thấy địa chỉ mặc định', 404)
        }
        return res.json({ success: true, data: address })
    } catch (error) {
        next(error)
    }
}
