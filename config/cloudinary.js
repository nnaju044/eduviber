import { v2 as cloudinary } from "cloudinary";

/**
 * Configure Cloudinary SDK dynamically to guarantee environment variables are read
 * even if this module is imported before dotenv.config() finishes.
 */
export function getCloudinaryClient() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

/**
 * Checks whether Cloudinary credentials are fully configured in the environment
 */
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// Initial config for standard module consumers
getCloudinaryClient();

export default cloudinary;

/**
 * Generates the deterministic Cloudinary public ID for a student avatar
 * Format: eduvibe/students/<MongoDB User._id>
 */
export function getStudentAvatarPublicId(userId) {
  return `eduvibe/students/${String(userId)}`;
}

/**
 * Generates the delivery URL for a student's avatar with transformation & cache-busting version
 * Returns null if user has no avatar (avatarVersion <= 0)
 */
export function getStudentAvatarUrl(userId, avatarVersion = 0) {
  if (!avatarVersion || avatarVersion <= 0) {
    return null;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return null;
  }

  const publicId = getStudentAvatarPublicId(userId);
  return cloudinary.url(publicId, {
    version: avatarVersion,
    secure: true,
    width: 300,
    height: 300,
    crop: "fill",
    gravity: "face",
    fetch_format: "auto",
    quality: "auto",
  });
}
