import bcrypt from "bcryptjs";
import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email la bat buoc"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "email khong hop le"]
    },
    password: {
        type: String,
        required: [true, "Mật khẩu không để trống"],
        minlength: [6, "Mat khau phai it nhat co 6 ki tu"],
        select: false
    },
    role: {
        type: String,
        enum: ["admin", "pt", "staff", "member"],
        default: "member"
    },
    phone: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        match: [/^(0|\+84)[0-9]{9}$/, "so diẹn thoai phai hop le"]
    },
    avatar: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resetPasswordOTP: {
        type: String,
        select: false
    },
    resetPasswordOTPExpires: {
        type: Date,
        select: false
    },
    refreshToken: {
        type: String,
        select: false
    }
}, { timestamps: true })

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12)

})
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetPasswordOTP;
    delete obj.resetPasswordOTPExpires;
    delete obj.refreshToken;
    return obj
}
const User = mongoose.model("User", userSchema)
export default User