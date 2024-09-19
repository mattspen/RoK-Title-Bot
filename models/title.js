// models/Title.js
import mongoose from "mongoose";

const titleSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  kingdom: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
});

const Title = mongoose.model("Title", titleSchema);

export default Title;
