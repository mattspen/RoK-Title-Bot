import { findImageInImage } from "./findImage";

export const findImage = async (
  outterImage: string,
  innerImage: string,
  outerImageType: string,
  innerImageType: string,
  aspectRatio?: number
) => {
  const foundImage = await findImageInImage(
    outterImage,
    innerImage,
    outerImageType,
    innerImageType,
    aspectRatio
  );
  return foundImage;
};

export const findImages = async (
  outterImage: string,
  innerImage: string,
  outerImageType: string,
  innerImageType: string,
  findMaxAmount?: number,
  aspectRatio?: number,
  similarityThreshold?: number
) => {
  const foundImage = await findImageInImage(
    outterImage,
    innerImage,
    outerImageType,
    innerImageType,
    aspectRatio ?? 1,
    findMaxAmount ?? 99,
    similarityThreshold ?? 1
  );
  return foundImage;
};
