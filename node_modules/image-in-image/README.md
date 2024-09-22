# 🔍 Search for image in image

With this package you can find an image as part of another image. In other words, picture-in-picture search returning position coordinates.

Image search is done while matching image pixels color and it has to be pixel perfect match. This solution is suitable for search in screenshot while looking for some part of the screen. It is not suitable for hand written digit recognition or searchng for something not exactly the same, so keep that in mind.

For a result you get `x` and `y` as a position by pixels in image from top left. Result gives you center point of found inner image in outer image.

For errors, you get { error: `code`, message: `description` }

Possible error codes and descriptions:

- 500 - "Something went wrong, might be that images path not right"
- 400 - "Inner bigger than outer"
- 404 - "Image not found"

## Usage

```
npm i image-in-image
```

## Functions

---

### findImage

```js
findImage(
  outerImagePath, // your main image inside which you search
  innerImagePath, // your inner,smaller image you looking for
  outerImageMimeType // outer image type
  innerImageMimeType, // inner image type, e.g. "image/png" if .png
  //optionals
  aspectRatio, // aspect ratio, default 1, required when screenshot and screen size not the same
);
```

e.g.

```js
import { findImage } from "image-in-image";

const main = async () => {
  const test = await findImage(
    "outer.png",
    "inner.png",
    "image/png",
    "image/png",
    1 // optional aspect ratio, default 1
  );
  console.log(test);
};

main();
```

Should return something similar:

```json
{ "x": 268.5, "y": 161 }
```

---

### findImages

```js
import { findImages } from "image-in-image";

const main = async () => {
  const test2 = await findImages(
    "dots.png",
    "dot.png",
    "image/png",
    "image/png",
    2, // optional amount of max found, default 99
    1 // optional aspect ratio, default 1
  );
  console.log(test2);
};

main();
```

if findMaxAmount set to >2, returns always in array:

```json
[
  { "x": 53, "y": 80.5 },
  { "x": 162, "y": 80.5 }
]
```

---

### use Buffers instead images

```js
import { findImages } from "image-in-image";

const main = async () => {
  const test2 = await findImages(
    BufferOfDots,
    BufferOfDot,
    "image/png",
    "image/png",
    2, // optional amount of max found, default 99
    1 // optional aspect ratio, default 1
  );
  console.log(test2);
};

main();
```

---

### use Similarity option for not exact match

```js
import { findImages } from "image-in-image";

const main = async () => {
  const test3 = await findImages(
    BufferOfDotsNotExact,
    BufferOfDot,
    "image/png",
    "image/png",
    1, // optional amount of max found, default 99
    1, // optional aspect ratio, default 1
    0.88 // optional similarity, default 1
  );
  console.log(test3);
};

main();
```
