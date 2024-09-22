import sharp from "sharp";
import Jimp from "jimp";

export const findImageInImage = async (
  outerImage: string | Buffer,
  innerImage: string | Buffer,
  outerImageType: string,
  innerImageType: string,
  aspectRatio = 1,
  max = 1,
  similarityThreshold = 1
) => {
  try {
    var buffer;
    if (typeof outerImage == "string") {
      const outerImg = await Jimp.read(outerImage);
      buffer = await outerImg.getBufferAsync(outerImageType);
    } else {
      buffer = outerImage;
    }
    var innerBuffer;
    if (typeof innerImage == "string") {
      const innerImg = await Jimp.read(innerImage);
      innerBuffer = await innerImg.getBufferAsync(innerImageType);
    } else {
      innerBuffer = innerImage;
    }

    const file_o = sharp(buffer);
    const file_i = sharp(innerBuffer);
    const buff_o = await file_o.raw().toBuffer();
    const buff_i = await file_i.raw().toBuffer();
    const meta_o = await file_o.metadata();
    const meta_i = await file_i.metadata();
    if (
      meta_o.width &&
      meta_i.width &&
      meta_o.channels &&
      meta_i.channels &&
      meta_o.height &&
      meta_i.height
    ) {
      const size_o = meta_o.width * meta_o.channels;
      const size_i = meta_i.width * meta_i.channels;
      const upper = buff_i.slice(0, size_i); // upper row of inner
      let found = -1;
      const finds: any[] = [];
      if (meta_i.width <= meta_o.width && meta_i.height <= meta_o.height) {
        // must be containable within
        do {
          found = buff_o.indexOf(upper, found + 1); // upper row is present, so its another candidate

          if (found != -1) {
            let matches: boolean = true;

            const oy = Math.floor(found / size_o);
            const ox = Math.floor((found - size_o * oy) / meta_o.channels);

            for (let y = 1; matches && y < meta_i.height; y++) {
              // start from one as upper row is already matched

              const pos_i = y * size_i;
              const pos_o = y * size_o + found;

              const slice_i = buff_i.slice(pos_i, pos_i + size_i);
              const slice_o = buff_o.slice(pos_o, pos_o + size_i);

              const similarity = calculateSimilarity(slice_o, slice_i);

              matches = similarity >= similarityThreshold;
            }

            if (matches) {
              finds.push({ x: ox, y: oy, w: meta_i.width, h: meta_i.height });
            }
          }
        } while (found != -1 && finds.length < max);
      } else {
        return { error: 400, message: "Inner bigger than outer" };
      }
      if (finds.length > 0) {
        const imageWCenter = meta_i.width / 2;
        const imageHCenter = meta_i.height / 2;
        return max == 1
          ? {
              x: (finds[0].x + imageWCenter) / aspectRatio,
              y: (finds[0].y + imageHCenter) / aspectRatio,
            }
          : finds.map((find) => {
              return {
                x: (find.x + imageWCenter) / aspectRatio,
                y: (find.y + imageHCenter) / aspectRatio,
              };
            });
      } else {
        return { error: 404, message: "Image not found" };
      }
    }
  } catch (e: any) {
    return {
      error: 500,
      message: "Something went wrong, might be that images path not right",
    };
  }
};

const calculateSimilarity = (slice1: Buffer, slice2: Buffer): number => {
  if (slice1.length !== slice2.length) {
    throw new Error("Image slices must have the same length");
  }

  let sumSquaredDiff = 0;
  for (let i = 0; i < slice1.length; i++) {
    const diff = slice1[i] - slice2[i];
    sumSquaredDiff += diff * diff;
  }

  const mse = sumSquaredDiff / slice1.length;
  const similarity = 1 - mse / 255 ** 2; // Normalize the similarity to a value between 0 and 1

  return similarity;
};
