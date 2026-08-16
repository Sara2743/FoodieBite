const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const { v2: cloudinary } = require("cloudinary");

// =====================================================
// ENV CHECK
// =====================================================

const required = [
  "OLD_CLOUDINARY_CLOUD_NAME",
  "OLD_CLOUDINARY_API_KEY",
  "OLD_CLOUDINARY_API_SECRET",
  "NEW_CLOUDINARY_CLOUD_NAME",
  "NEW_CLOUDINARY_API_KEY",
  "NEW_CLOUDINARY_API_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const OLD = {
  cloud_name: process.env.OLD_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.OLD_CLOUDINARY_API_KEY,
  api_secret: process.env.OLD_CLOUDINARY_API_SECRET,
};

const NEW = {
  cloud_name: process.env.NEW_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEW_CLOUDINARY_API_KEY,
  api_secret: process.env.NEW_CLOUDINARY_API_SECRET,
};

// =====================================================
// GET OLD CLOUDINARY RESOURCES
// =====================================================

async function getAllImages() {
  const oldCloudinary = cloudinary.config({
    cloud_name: OLD.cloud_name,
    api_key: OLD.api_key,
    api_secret: OLD.api_secret,
  });

  const allImages = [];
  let nextCursor = undefined;

  do {
    console.log("Getting images from old Cloudinary...");

    const result = await new Promise((resolve, reject) => {
      cloudinary.api.resources(
        {
          resource_type: "image",
          type: "upload",
          max_results: 500,
          next_cursor: nextCursor,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });

    if (result.resources) {
      allImages.push(...result.resources);
    }

    nextCursor = result.next_cursor;

    console.log(`Found so far: ${allImages.length}`);
  } while (nextCursor);

  return allImages;
}

// =====================================================
// UPLOAD TO NEW CLOUDINARY
// =====================================================

async function uploadToNewCloudinary(image) {
  const newCloudinary = cloudinary.config({
    cloud_name: NEW.cloud_name,
    api_key: NEW.api_key,
    api_secret: NEW.api_secret,
  });

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      image.secure_url,
      {
        public_id: image.public_id,
        resource_type: image.resource_type || "image",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
}

// =====================================================
// MAIN MIGRATION
// =====================================================

async function migrate() {
  try {
    console.log("");
    console.log("==========================================");
    console.log("      CLOUDINARY MIGRATION STARTING");
    console.log("==========================================");
    console.log("");

    console.log("OLD:", OLD.cloud_name);
    console.log("NEW:", NEW.cloud_name);
    console.log("");

    const images = await getAllImages();

    console.log("");
    console.log(`Total images found: ${images.length}`);
    console.log("");

    if (images.length === 0) {
      console.log("No images found.");
      return;
    }

    let success = 0;
    let failed = 0;

    const failedImages = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      console.log(
        `[${i + 1}/${images.length}] Migrating: ${image.public_id}`
      );

      try {
        await uploadToNewCloudinary(image);

        success++;

        console.log("   ✓ Success");
      } catch (error) {
        failed++;

        failedImages.push(image.public_id);

        console.log("   ✗ Failed");
        console.log(`     ${error.message}`);
      }
    }

    console.log("");
    console.log("==========================================");
    console.log("      MIGRATION FINISHED");
    console.log("==========================================");

    console.log(`Total  : ${images.length}`);
    console.log(`Success: ${success}`);
    console.log(`Failed : ${failed}`);

    if (failedImages.length > 0) {
      console.log("");
      console.log("Failed images:");

      failedImages.forEach((id) => {
        console.log(` - ${id}`);
      });
    }

    console.log("==========================================");
  } catch (error) {
    console.error("");
    console.error("Migration failed:");
    console.error(error);
    process.exit(1);
  }
}

migrate();