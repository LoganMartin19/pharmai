// functions/index.js (Firebase Functions v2)
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
          "Only provide medicine information that is grounded in the UK Electronic Medicines Compendium (EMC) or the British National Formulary (BNF). " +
          "Do not use or reference any other medicine-information source. " +
          "For every factual medicine statement you give the user, clearly label the source as [EMC], [BNF], or [EMC/BNF]. " +
          "Include a short Sources section at the end of every medicine-information answer listing only the sites used: EMC and/or BNF. " +
          "If you cannot answer from EMC or BNF, say you cannot confirm that from EMC or BNF and suggest checking with a pharmacist or doctor. " +
          "Explain dosing, timing, interactions, side effects and when to seek help only when they can be attributed to EMC or BNF. " +
          "NEVER diagnose or replace medical advice. " +
          "If an answer requires a professional, say so and suggest contacting a pharmacist/doctor or emergency services when appropriate. " +
          "Use short plain-language sections and bullet points when helpful, but do not use markdown heading syntax like ### or bold markers. " +
          "Keep a reassuring, non-judgmental tone.",
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

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function sendExpoPushNotifications(messages) {
  if (!messages.length) return { sent: 0, tickets: [] };

  const tickets = [];
  for (const chunk of chunkArray(messages, 100)) {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      console.error("Expo push send failed:", resp.status, json);
      continue;
    }
    tickets.push(json);
  }

  return { sent: messages.length, tickets };
}

function safeAlertId(parts) {
  return parts
    .map((part) => String(part ?? "x").replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join("_")
    .slice(0, 180);
}

async function getCaregiversForPatient(patientUid) {
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
        notifyCare: data.notifyCare !== false,
        delayMin: Number(data.notifyDelayMinutes || 60),
      });
    }
  });
  return caregivers;
}

async function fanOutMissedDoseAlert({ patientUid, medId, medName, doseDate, doseIndex }) {
  const caregivers = await getCaregiversForPatient(patientUid);
  if (caregivers.length === 0) {
    return { ok: true, notified: 0, pushSent: 0, duplicate: 0 };
  }

  const patientDoc = await db.collection("users").doc(patientUid).get();
  const patientName =
    (patientDoc.exists && (patientDoc.data().displayName || patientDoc.data().name)) || null;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  let notified = 0;
  let duplicate = 0;
  const pushMessages = [];

  for (const { caregiverUid, notifyCare } of caregivers) {
    if (!notifyCare) continue;

    const alertId = safeAlertId([patientUid, medId, doseDate, doseIndex]);
    const inboxRef = db
      .collection("users")
      .doc(caregiverUid)
      .collection("inbox")
      .doc(alertId);

    const existing = await inboxRef.get();
    if (existing.exists) {
      duplicate++;
      continue;
    }

    batch.set(inboxRef, {
      type: "missedDose",
      createdAt: now,
      delivered: false,
      unread: true,
      patientName,
      patientUid,
      medId,
      medName: medName || null,
      doseDate,
      doseIndex: typeof doseIndex === "number" ? doseIndex : null,
    });

    const tokenSnap = await db
      .collection("users")
      .doc(caregiverUid)
      .collection("expoPushTokens")
      .get();

    tokenSnap.forEach((tokenDoc) => {
      const token = tokenDoc.data()?.token;
      if (typeof token !== "string" || !/^(ExponentPushToken|ExpoPushToken)\[/.test(token)) return;
      pushMessages.push({
        to: token,
        sound: "default",
        priority: "high",
        title: "Missed dose alert",
        body: `${patientName || "Patient"} missed ${medName || "a dose"}`,
        data: {
          type: "missedDose",
          patientUid,
          medId,
          medName: medName || null,
          doseDate,
          doseIndex: typeof doseIndex === "number" ? doseIndex : null,
        },
      });
    });

    notified++;
  }

  await batch.commit();
  const push = await sendExpoPushNotifications(pushMessages);
  return { ok: true, notified, pushSent: push.sent, duplicate };
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

      const result = await fanOutMissedDoseAlert({
        patientUid,
        medId,
        medName,
        doseDate,
        doseIndex,
      });
      return res.json(result);
    } catch (e) {
      console.error("reportMissedDose failed:", e);
      return res.status(500).json({ error: "report_failed" });
    }
  });
});

function nextPendingDueAtFrom({ doseDate, time, delayMin }) {
  if (!doseDate || !time) return null;
  const [hourRaw, minuteRaw] = String(time).split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const nextDose = new Date(`${doseDate}T00:00:00.000Z`);
  nextDose.setUTCDate(nextDose.getUTCDate() + 1);
  nextDose.setUTCHours(hour, minute, 0, 0);
  return admin.firestore.Timestamp.fromMillis(nextDose.getTime() + delayMin * 60 * 1000);
}

async function scheduleNextPendingAlert({ patientUid, med, medId, doseIndex, doseDate, delayMin }) {
  const times = Array.isArray(med.times)
    ? med.times
    : String(med.time || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

  const time = times[doseIndex];
  const nextDueAt = nextPendingDueAtFrom({ doseDate, time, delayMin });
  if (!nextDueAt) return;

  const nextDoseDate = new Date(`${doseDate}T00:00:00.000Z`);
  nextDoseDate.setUTCDate(nextDoseDate.getUTCDate() + 1);
  const nextDoseDateIso = nextDoseDate.toISOString().slice(0, 10);

  if (med.endDate && nextDoseDateIso > med.endDate) return;

  const pendingId = safeAlertId([medId, doseIndex]);
  await db
    .collection("users")
    .doc(patientUid)
    .collection("carePendingAlerts")
    .doc(pendingId)
    .set(
      {
        medId,
        medName: med.name || null,
        doseIndex,
        doseDate: nextDoseDateIso,
        dueAt: nextDueAt,
        processed: false,
        lastRolledForwardAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

exports.processCarePendingAlerts = onSchedule("every 5 minutes", async () => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db
    .collectionGroup("carePendingAlerts")
    .where("dueAt", "<=", now)
    .limit(100)
    .get();

  if (snap.empty) return;

  for (const pendingDoc of snap.docs) {
    try {
      const data = pendingDoc.data() || {};
      const patientRef = pendingDoc.ref.parent.parent;
      const patientUid = patientRef?.id;
      const medId = data.medId;
      const doseDate = data.doseDate;
      const doseIndex = Number(data.doseIndex);

      if (!patientUid || !medId || !doseDate || !Number.isFinite(doseIndex)) {
        await pendingDoc.ref.delete();
        continue;
      }

      const medSnap = await db
        .collection("users")
        .doc(patientUid)
        .collection("reminders")
        .doc(medId)
        .get();

      if (!medSnap.exists) {
        await pendingDoc.ref.delete();
        continue;
      }

      const med = medSnap.data() || {};
      const history = Array.isArray(med.history) ? med.history : [];
      const dayHistory = history.find((row) => row?.date === doseDate);
      const isTaken = !!dayHistory?.taken?.[doseIndex];

      if (isTaken) {
        // Nothing to send.
      } else {
        await fanOutMissedDoseAlert({
          patientUid,
          medId,
          medName: data.medName || med.name || null,
          doseDate,
          doseIndex,
        });
      }

      const caregivers = await getCaregiversForPatient(patientUid);
      const activeDelays = caregivers
        .filter((caregiver) => caregiver.notifyCare)
        .map((caregiver) => caregiver.delayMin)
        .filter((minutes) => Number.isFinite(minutes) && minutes > 0);
      const delayMin = activeDelays.length ? Math.min(...activeDelays) : 60;

      await pendingDoc.ref.delete();

      await scheduleNextPendingAlert({
        patientUid,
        med,
        medId,
        doseIndex,
        doseDate,
        delayMin,
      });
    } catch (e) {
      console.error("processCarePendingAlerts item failed:", pendingDoc.ref.path, e);
      await pendingDoc.ref.set(
        {
          lastError: String(e?.message || e),
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
});
