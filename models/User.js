import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
  },
  kingdom: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return /^\d{4}$/.test(value);
      },
      message: props => `${props.value} is not a valid 4-digit kingdom number!`
    },
  },
  x: {
    type: Number,
    required: true,
    min: 0,
  },
  y: {
    type: Number,
    required: true,
    min: 0,
  },
});

const User = mongoose.model("User", userSchema);

export default User;
