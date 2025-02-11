import generateMessageHash from "./generateMessageHash";

const activeRequests = new Map();

export default function processTitleRequest(message) {
    const hash = generateMessageHash(message);
  
    const existingRequest = activeRequests.get(message.title);
  
    if (
      existingRequest &&
      existingRequest.hash === hash
    ) {
      return false;
    }
  
    activeRequests.set(message.title, {
      hash,
      message,
    });
  
    console.log("Processing new request:", message);
    return true;
  }