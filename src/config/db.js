const mongoose = require('mongoose');

async function connectDB(uri) {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Mongo connection error', error.message);
    throw error;
  }
}

module.exports = connectDB;
