// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  kingdom: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return /^\d{4}$/.test(value); // Ensure it's a 4-digit number
      },
      message: props => `${props.value} is not a valid 4-digit kingdom number!`
    },
  },
  x: {
    type: Number,
    required: true, // Optional: Set to true if this field should be required
    min: 0, // Optional: Validate that x is a non-negative value
  },
  y: {
    type: Number,
    required: true, // Optional: Set to true if this field should be required
    min: 0, // Optional: Validate that y is a non-negative value
  },
});

const User = mongoose.model("User", userSchema);

export default User;
