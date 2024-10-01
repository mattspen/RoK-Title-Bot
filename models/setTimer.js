import mongoose from "mongoose";

// Define the schema for title durations
const titleDurationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    enum: ["Justice", "Duke", "Architect", "Scientist"], // Limit to specific titles
  },
  duration: {
    type: Number,
    required: true,
    min: 0, // Duration must be a non-negative integer
  },
  kingdom: {
    type: Number, // Ensure kingdom is stored as an integer
    required: true,
  },
});

// Ensure uniqueness of title and kingdom combination
titleDurationSchema.index({ title: 1, kingdom: 1 }, { unique: true });

// Check if the model already exists to prevent overwriting
const TitleDuration =
  mongoose.models.TitleDuration ||
  mongoose.model("TitleDuration", titleDurationSchema);

// Export the model
export default TitleDuration;
