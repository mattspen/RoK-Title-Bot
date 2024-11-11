import mongoose from "mongoose";

// Define the schema for locked titles
const lockedTitleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    enum: ["Justice", "Duke", "Architect", "Scientist"], // Ensure only valid titles can be locked
  },
  kingdom: {
    type: Number, // Ensure kingdom is stored as an integer
    required: true,
  },
  isLocked: {
    type: Boolean,
    default: false, // Default value is false
  },
  lockedBy: {
    type: String, // Store the ID of the user who locked the title
    default: null,
  },
  lockedAt: {
    type: Date, // Store the timestamp when the title was locked
    default: null,
  },
});

// Ensure uniqueness of title and kingdom combination
lockedTitleSchema.index({ title: 1, kingdom: 1 }, { unique: true });

// Check if the model already exists to prevent overwriting
const LockedTitle =
  mongoose.models.LockedTitle ||
  mongoose.model("LockedTitle", lockedTitleSchema);

// Export the model
export default LockedTitle;
