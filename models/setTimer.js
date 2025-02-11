import mongoose from "mongoose";

const titleDurationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    enum: ["Justice", "Duke", "Architect", "Scientist"],
  },
  duration: {
    type: Number,
    required: true,
    min: 0,
  },
  kingdom: {
    type: Number,
    required: true,
  },
});

titleDurationSchema.index({ title: 1, kingdom: 1 }, { unique: true });

const TitleDuration =
  mongoose.models.TitleDuration ||
  mongoose.model("TitleDuration", titleDurationSchema);

export default TitleDuration;
