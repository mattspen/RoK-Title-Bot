export default function generateMessageHash(message) {
    return `${message.title}|${message.kingdom}|${message.x}|${message.y}|${message.isLostKingdom}`;
  }