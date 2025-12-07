const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    affiliateBalance: { type: Number, default: 0 },
    affiliateTotalEarned: { type: Number, default: 0 },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.pre('save', async function (next) {
  if (this.referralCode) return next();
  const code = `FX${Math.random().toString(36).slice(2, 7).toUpperCase()}${Date.now()
    .toString()
    .slice(-3)}`;
  this.referralCode = code;
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
