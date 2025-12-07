const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['client', 'admin'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FeedbackSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5 },
    gradeReceived: { type: String },
    comment: { type: String },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', FeedbackSchema);
