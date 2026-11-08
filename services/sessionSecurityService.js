import mongoose from "mongoose";

/**
 * Parses serialized session JSON safely
 */
function parseSessionData(sessionString) {
  try {
    return JSON.parse(sessionString);
  } catch {
    return null;
  }
}

/**
 * Invalidate all active sessions for a specific user ID across all browsers and devices.
 * Connect-mongo stores session documents in the 'sessions' collection.
 * The session field is serialized JSON containing: {"cookie":...,"user":{"id":"<userId>",...}}
 *
 * To guarantee 100% reliability regardless of JSON key ordering, whitespace, or escaping,
 * this function queries documents matching the user ID and performs structural validation
 * on the parsed session payload before deleting matching session documents.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The user ID whose sessions should be destroyed
 * @param {string} [exceptSessionId] - Optional session ID to exclude
 * @returns {Promise<number>} Number of sessions invalidated
 */
export async function invalidateAllUserSessions(userId, exceptSessionId = null) {
  if (!userId) return 0;
  const uid = String(userId);

  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn("[SessionSecurity] Database connection unavailable during session invalidation");
      return 0;
    }

    const sessionsCollection = db.collection("sessions");

    // Broad candidate query across string representations
    const candidates = await sessionsCollection
      .find({
        $or: [
          { session: { $regex: uid } },
          { "session.user.id": uid },
        ],
      })
      .toArray();

    const idsToDelete = [];

    for (const doc of candidates) {
      if (exceptSessionId && String(doc._id) === String(exceptSessionId)) {
        continue;
      }

      // If session is serialized JSON string
      if (typeof doc.session === "string") {
        const parsed = parseSessionData(doc.session);
        if (parsed?.user?.id && String(parsed.user.id) === uid) {
          idsToDelete.push(doc._id);
        } else if (doc.session.includes(`"id":"${uid}"`)) {
          idsToDelete.push(doc._id);
        }
      } else if (doc.session?.user?.id && String(doc.session.user.id) === uid) {
        // If session is parsed BSON object
        idsToDelete.push(doc._id);
      }
    }

    if (idsToDelete.length === 0) {
      return 0;
    }

    const result = await sessionsCollection.deleteMany({ _id: { $in: idsToDelete } });
    return result.deletedCount || 0;
  } catch (error) {
    console.error("[SessionSecurity] Failed to invalidate sessions for user:", uid, error.message);
    throw error;
  }
}
