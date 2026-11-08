import crypto from "node:crypto";
import Device from "../models/Device.js";
import User from "../models/User.js";
import { sendNewDeviceRegisteredEmail, sendDeviceLimitBlockedEmail } from "./emailService.js";

const DEVICE_COOKIE_NAME = "eduvibe_device_token";
const MAX_DEVICES_PER_STUDENT = 2;

/**
 * Hash raw token using sha256
 */
export function hashDeviceToken(rawToken) {
    return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
}

/**
 * Generate a cryptographically secure device token
 */
export function generateDeviceToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Detect client browser, OS, and device type from User-Agent
 */
export function parseDeviceInfo(userAgent = "") {
    let browser = "Web Browser";
    let os = "Desktop OS";
    let deviceType = "Desktop";

    const ua = userAgent.toLowerCase();

    // OS detection
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
        os = "iOS";
        deviceType = ua.includes("ipad") ? "Tablet" : "Mobile";
    } else if (ua.includes("android")) {
        os = "Android";
        deviceType = ua.includes("mobile") ? "Mobile" : "Tablet";
    } else if (ua.includes("mac os") || ua.includes("macintosh")) {
        os = "macOS";
        deviceType = "Desktop";
    } else if (ua.includes("windows")) {
        os = "Windows";
        deviceType = "Desktop";
    } else if (ua.includes("linux")) {
        os = "Linux";
        deviceType = "Desktop";
    }

    // Browser detection
    if (ua.includes("edg/")) {
        browser = "Microsoft Edge";
    } else if (ua.includes("chrome") && !ua.includes("edg") && !ua.includes("opr")) {
        browser = "Google Chrome";
    } else if (ua.includes("safari") && !ua.includes("chrome")) {
        browser = "Safari";
    } else if (ua.includes("firefox")) {
        browser = "Mozilla Firefox";
    } else if (ua.includes("opr") || ua.includes("opera")) {
        browser = "Opera";
    }

    const deviceName = `${browser} on ${os}`;
    return { deviceName, deviceType, browser, os };
}

/**
 * Helper to extract cookie value from Express request
 * Handles both req.cookies (if cookie-parser is installed) and req.headers.cookie
 */
function getCookie(req, name) {
    if (req?.cookies && req.cookies[name]) {
        return req.cookies[name];
    }
    const cookieHeader = req?.headers?.cookie;
    if (!cookieHeader || typeof cookieHeader !== "string") {
        return null;
    }
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get or register device for authenticated student
 * Enforces maximum 2 devices per student
 */
export async function authenticateDevice(req, res, userId) {
    const rawToken = getCookie(req, DEVICE_COOKIE_NAME) || req.headers?.["x-device-token"];
    const userAgent = req.headers?.["user-agent"] || "";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";

    const activeDevices = await Device.find({ userId, isRevoked: false }).sort({ lastActiveAt: -1 });

    if (rawToken) {
        const tokenHash = hashDeviceToken(rawToken);
        const existingDevice = activeDevices.find((d) => d.tokenHash === tokenHash);

        if (existingDevice) {
            // Update last active timestamp
            existingDevice.lastActiveAt = new Date();
            existingDevice.ipAddress = ipAddress;
            await existingDevice.save();

            return {
                authorized: true,
                device: existingDevice,
                rawToken,
            };
        }
    }

    // New device registration attempt
    if (activeDevices.length >= MAX_DEVICES_PER_STUDENT) {
        // Send alert if third device was rejected
        User.findById(userId).then((user) => {
            if (user) {
                const { browser, os } = parseDeviceInfo(userAgent);
                sendDeviceLimitBlockedEmail({ user, attemptDetails: { browser, os } }).catch((err) => {
                    console.error("[DeviceService] Error sending device limit blocked email:", err.message);
                });
            }
        }).catch(() => { });

        return {
            authorized: false,
            code: "DEVICE_LIMIT_EXCEEDED",
            message: `You have reached the maximum limit of ${MAX_DEVICES_PER_STUDENT} registered devices. Please remove an existing device in your account settings before registering this device.`,
            activeDevices: activeDevices.map((d) => ({
                id: d._id.toString(),
                deviceName: d.deviceName,
                deviceType: d.deviceType,
                browser: d.browser,
                os: d.os,
                lastActiveAt: d.lastActiveAt,
                createdAt: d.createdAt,
            })),
        };
    }

    // Register new device
    const newRawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(newRawToken);
    const { deviceName, deviceType, browser, os } = parseDeviceInfo(userAgent);

    const newDevice = await Device.create({
        userId,
        tokenHash,
        deviceName,
        deviceType,
        browser,
        os,
        ipAddress,
        lastActiveAt: new Date(),
        isRevoked: false,
    });

    // Send security notification only on fresh successful registration (not on repeat playback)
    User.findById(userId).then((user) => {
        if (user) {
            sendNewDeviceRegisteredEmail({ user, device: newDevice }).catch((err) => {
                console.error("[DeviceService] Error sending new device registered email:", err.message);
            });
        }
    }).catch(() => { });

    // Set cookie (6 months expiry, httpOnly, sameSite lax)
    if (res && typeof res.cookie === "function") {
        res.cookie(DEVICE_COOKIE_NAME, newRawToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 180 * 24 * 60 * 60 * 1000,
        });
    }

    return {
        authorized: true,
        device: newDevice,
        rawToken: newRawToken,
    };
}

/**
 * Revokes all active registered devices for a student
 * Called during password change and password reset to enforce total re-registration
 *
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {object} [res] - Optional express response to clear the device cookie
 * @returns {Promise<number>} Number of devices revoked
 */
export async function revokeAllStudentDevices(userId, res = null) {
    if (!userId) return 0;

    const result = await Device.updateMany(
        { userId, isRevoked: false },
        { $set: { isRevoked: true } }
    );

    if (res && typeof res.clearCookie === "function") {
        res.clearCookie(DEVICE_COOKIE_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });
    }

    return result.modifiedCount || 0;
}
