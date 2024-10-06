// models/TitleRequestLog.js
import mongoose from "mongoose";

const titleRequestLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  title: { type: String, required: true },
  kingdom: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    enum: ["successful", "unsuccessful"],
  },
  timestamp: { type: Date, default: Date.now },
});

const TitleRequestLog = mongoose.model(
  "TitleRequestLog",
  titleRequestLogSchema
);

export default TitleRequestLog;
