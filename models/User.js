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
});

const User = mongoose.model("User", userSchema);

export default User;
