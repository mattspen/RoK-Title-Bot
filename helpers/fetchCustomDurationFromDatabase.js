import TitleDuration from "../models/setTimer.js";

export async function fetchCustomDurationFromDatabase(title, kingdom) {
  try {
    // Use the already defined model and filter by title and kingdom
    const result = await TitleDuration.findOne({ title, kingdom });

    if (result) {
      return result.duration;
    } else {
      return null; // Return null if no custom duration is found
    }
  } catch (error) {
    console.error(
      `Error fetching custom duration for ${title} in kingdom ${kingdom}:`,
      error
    );
    return null; // Return null in case of an error
  }
}
