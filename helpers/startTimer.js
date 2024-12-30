export default function startTimer(collector, remainingTime, title, userId) {
    let timer = setInterval(() => {
      remainingTime -= 1;
      if (remainingTime <= 0) {
        clearInterval(timer);
        if (collector && !collector.ended) {
          collector.stop();
        }
      } else {
        if (remainingTime % 30 === 0) {
          console.log(
            `User ${userId} has ${remainingTime} seconds remaining for the title "${title}".`
          );
        }
      }
    }, 1000);
    return timer;
  }