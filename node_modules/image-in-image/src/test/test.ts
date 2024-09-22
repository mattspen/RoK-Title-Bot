import { findImage, findImages } from "..";

const main = async () => {
  const test1 = await findImage(
    "build/test/dots.png",
    "build/test/dot.png",
    "image/png",
    "image/png"
  );
  console.log("Test basic ", test1);
  const test2 = await findImages(
    "build/test/dots.png",
    "build/test/dot.png",
    "image/png",
    "image/png",
    2, // optional amount of max found
    1 // optional aspect ratio
  );
  console.log("Test multiple ", test2);
  const test3 = await findImages(
    "build/test/dots_misc.png",
    "build/test/dot.png",
    "image/png",
    "image/png",
    1, // optional amount of max found
    1, // optional aspect ratio
    0.88 // optional similarity threshold
  );
  console.log("Test Similarity ", test3);
};

main();
