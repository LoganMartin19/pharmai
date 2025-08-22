// functions/index.js (Firebase Functions v2)
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const admin = require("firebase-admin");
const cors = require("cors");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({ origin: true });

// Global defaults for this codebase
setGlobalOptions({
  timeoutSeconds: 60,
  memory: "512MiB",
  secrets: ["OPENAI_API_KEY"], // <-- ensure this secret exists
});

/* =======================================================================================
 * Chat (unchanged)
 * ======================================================================================= */
exports.chat = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // 🔐 Verify Firebase user
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!idToken) return res.status(401).json({ error: "unauthorized" });
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      // Payload: { messages: Msg[], chatId?: string }
      const { messages = [], chatId } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "invalid payload" });
      }

      // 🧠 System prompt
      const system = {
        role: "system",
        content:
          "You are PharmAI, a friendly pharmacist assistant. Be concise and clear. " +
          "Explain dosing, timing, interactions, side effects and when to seek help. " +
          "NEVER diagnose or replace medical advice. " +
          "If an answer requires a professional, say so and suggest contacting a pharmacist/doctor or emergency services when appropriate. " +
          "Use bullet points when helpful. Keep a reassuring, non-judgmental tone.",
      };

      // 🧹 Keep only recent context
      const MAX_CONTEXT = 10;
      const trimmed = messages.slice(-MAX_CONTEXT);

      // Create OpenAI client with v2 secret
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // 🧾 Call OpenAI
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [system, ...trimmed],
      });

      const reply =
        resp.choices?.[0]?.message?.content ||
        "Sorry, I couldn't generate a response.";

      // 🗂️ Save to Firestore
      const chatRef = chatId
        ? db.collection("users").doc(uid).collection("chats").doc(chatId)
        : db.collection("users").doc(uid).collection("chats").doc();

      const createdId = chatRef.id;

      const batch = db.batch();
      const msgsCol = chatRef.collection("messages");
      const now = admin.firestore.FieldValue.serverTimestamp();

      batch.set(
        chatRef,
        {
          updatedAt: now,
          title: messages[0]?.content?.slice(0, 60) || "New conversation",
        },
        { merge: true }
      );

      const toSave = [
        ...trimmed.slice(-1), // latest user message
        { role: "assistant", content: reply },
      ];

      toSave.forEach((m) => {
        const docRef = msgsCol.doc();
        batch.set(docRef, { ...m, createdAt: now });
      });

      await batch.commit();

      return res.json({ reply, chatId: createdId });
    } catch (err) {
      console.error("LLM error:", err);
      const status =
        (err && typeof err.status === "number" && err.status) ||
        (err && err.code === "insufficient_quota" && 402) ||
        500;
      return res.status(status).json({ error: "llm_error" });
    }
  });
});

/* =======================================================================================
 * Care invites (unchanged)
 * ======================================================================================= */
function randId(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// POST /createInvite   (Auth: Bearer <ID_TOKEN>)
exports.createInvite = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "unauthorized" });
      const decoded = await admin.auth().verifyIdToken(token);
      const patientUid = decoded.uid;

      const inviteId = randId(8);
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000); // 30 min

      await db.collection("careInvites").doc(inviteId).set({
        patientUid,
        createdAt: now,
        expiresAt,
      });

      res.json({ inviteId, expiresAt: expiresAt.toDate().toISOString() });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "create_invite_failed" });
    }
  });
});

// POST /acceptInvite   (Auth: Bearer <ID_TOKEN>) { inviteId, caregiverDisplayName? }
exports.acceptInvite = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      // ----- Auth -----
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "unauthorized" });
      const decoded = await admin.auth().verifyIdToken(token);
      const caregiverUid = decoded.uid;

      // ----- Input -----
      const { inviteId, caregiverDisplayName } = req.body || {};
      if (!inviteId) return res.status(400).json({ error: "missing_inviteId" });

      // ----- Load invite -----
      const inviteRef = db.collection("careInvites").doc(inviteId);
      const snap = await inviteRef.get();
      if (!snap.exists) return res.status(404).json({ error: "invite_not_found" });

      const { patientUid, expiresAt, status } = snap.data() || {};
      if (!patientUid) return res.status(400).json({ error: "invalid_invite" });
      if (status && status !== "active") return res.status(410).json({ error: "invite_unusable" });
      if (expiresAt && expiresAt.toMillis() < Date.now()) {
        return res.status(410).json({ error: "invite_expired" });
      }
      if (patientUid === caregiverUid) {
        return res.status(400).json({ error: "self_link_forbidden" });
      }

      // ----- Fetch profiles for display names -----
      const [patientDoc, caregiverDoc] = await Promise.all([
        db.collection("users").doc(patientUid).get(),
        db.collection("users").doc(caregiverUid).get(),
      ]);

      const patientName =
        (patientDoc.exists && (patientDoc.data().displayName || patientDoc.data().name)) || null;

      const caregiverName =
        caregiverDisplayName ||
        (caregiverDoc.exists && (caregiverDoc.data().displayName || caregiverDoc.data().name)) ||
        null;

      // ----- Write links (both directions) -----
      const batch = db.batch();
      const now = admin.firestore.FieldValue.serverTimestamp();

      // patient -> caregiver
      batch.set(
        db.collection("users").doc(patientUid).collection("careLinks").doc(caregiverUid),
        {
          role: "caregiver",
          displayName: caregiverName,   // caregiver’s name on the patient side
          peerUid: caregiverUid,
          createdAt: now,
        },
        { merge: true }
      );

      // caregiver -> patient
      batch.set(
        db.collection("users").doc(caregiverUid).collection("careLinks").doc(patientUid),
        {
          role: "patient",
          displayName: patientName,     // patient’s name on the caregiver side
          peerUid: patientUid,
          createdAt: now,
        },
        { merge: true }
      );

      // mark invite used (or delete if you prefer)
      batch.delete(inviteRef);

      await batch.commit();

      res.json({ ok: true, patientUid });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "accept_failed" });
    }
  });
});

/* =======================================================================================
 * NEW: reportMissedDose — patient reports a still-missed dose after the follow-up delay.
 * Fan-out an alert doc into each caregiver's inbox so the *caregiver device* can show a
 * local Notifee notification while we defer FCM integration.
 * =======================================================================================
 *
 * POST /reportMissedDose   (Auth: Bearer <ID_TOKEN>)
 * Body:
 * {
 *   medId: string,
 *   medName: string,
 *   doseDate: "YYYY-MM-DD",
 *   doseIndex?: number
 * }
 */
exports.reportMissedDose = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      // ----- Auth (patient) -----
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "unauthorized" });
      const decoded = await admin.auth().verifyIdToken(token);
      const patientUid = decoded.uid;

      // ----- Payload -----
      const { medId, medName, doseDate, doseIndex } = req.body || {};
      if (!medId || !doseDate) {
        return res.status(400).json({ error: "missing_fields" });
      }

      // ----- Gather caregivers linked to this patient -----
      const linksSnap = await db
        .collection("users")
        .doc(patientUid)
        .collection("careLinks")
        .get();

      const caregivers = [];
      linksSnap.forEach((d) => {
        const data = d.data() || {};
        if (data.role === "caregiver") {
          caregivers.push({
            caregiverUid: d.id,
            notifyCare: data.notifyCare !== false, // default true
            delayMin: Number(data.notifyDelayMinutes || 60),
          });
        }
      });

      if (caregivers.length === 0) {
        return res.json({ ok: true, notified: 0 });
      }

      // ----- Create inbox alerts for those who opted in -----
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      let notified = 0;

      caregivers.forEach(({ caregiverUid, notifyCare }) => {
        if (!notifyCare) return;
        const inboxRef = db
          .collection("users")
          .doc(caregiverUid)
          .collection("inbox")
          .doc();

        batch.set(inboxRef, {
          type: "missedDose",
          createdAt: now,
          unread: true,
          patientUid,
          medId,
          medName: medName || null,
          doseDate,
          doseIndex: typeof doseIndex === "number" ? doseIndex : null,
        });
        notified++;
      });

      await batch.commit();
      return res.json({ ok: true, notified });
    } catch (e) {
      console.error("reportMissedDose failed:", e);
      return res.status(500).json({ error: "report_failed" });
    }
  });
});