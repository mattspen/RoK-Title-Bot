import mongoose from "mongoose";

// Define the schema for title requests
const titleRequestSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    enum: ["Justice", "Duke", "Architect", "Scientist"], // Limit to specific titles
  },
  processed: {
    type: Boolean,
    default: false, // Default value for processed status
  },
  timestamp: {
    type: Date,
    default: Date.now, // Default to the current date/time
  },
  kingdom: {
    type: Number, // Ensure kingdom is stored as an integer
    required: true,
  },
});

// Ensure uniqueness of username, title, and kingdom combination
titleRequestSchema.index(
  { username: 1, title: 1, kingdom: 1 },
  { unique: true }
);

// Check if the model already exists to prevent overwriting
const TitleRequest =
  mongoose.models.TitleRequest ||
  mongoose.model("TitleRequest", titleRequestSchema);

// Export the model
export default TitleRequest;
