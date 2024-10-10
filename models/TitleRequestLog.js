import mongoose from "mongoose";

const TitleRequestLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  kingdom: { type: Number, required: true },
  username: { type: String, required: true },
  status: {
    type: String,
    enum: ["successful", "unsuccessful", "pending"], // Ensure "pending" is included
    required: true,
  },
});

const TitleRequestLog = mongoose.model(
  "TitleRequestLog",
  TitleRequestLogSchema
);

// Ensure you export the model correctly
export default TitleRequestLog; // Default export
