// functions/index.js (Firebase Functions v2)
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
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
  secrets: ["OPENAI_API_KEY"],
});

const NHS_CONTENT_BASE_URLS = {
  integration: "https://int.api.service.nhs.uk/nhs-website-content/",
  production: "https://api.service.nhs.uk/nhs-website-content/",
  sandbox: "https://sandbox.api.service.nhs.uk/nhs-website-content/",
};

const NHS_CONTENT_ROOTS = new Set([
  "baby",
  "conditions",
  "contraception",
  "health-a-to-z",
  "live-well",
  "manifest",
  "medicines",
  "mental-health",
  "nhs-services",
  "pregnancy",
  "social-care-and-support",
  "symptoms",
  "tests-and-treatments",
  "vaccinations",
  "womens-health",
]);

function getNhsContentBaseUrl() {
  const environment = (process.env.NHS_API_ENVIRONMENT || "production").toLowerCase();
  const baseUrl = NHS_CONTENT_BASE_URLS[environment];
  if (!baseUrl) throw new Error(`Unsupported NHS_API_ENVIRONMENT: ${environment}`);
  return { baseUrl, environment };
}

function normaliseNhsContentPath(input) {
  const path = String(input || "").trim().replace(/^\/+|\/+$/g, "");
  const root = path.split("/")[0];
  if (!path || !NHS_CONTENT_ROOTS.has(root) || path.includes("..")) return null;
  if (!/^[a-z0-9][a-z0-9\-/]*$/i.test(path)) return null;
  return `${path}/`;
}

async function requireFirebaseUser(req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return null;
  return admin.auth().verifyIdToken(idToken);
}

function collectNhsText(value, output = [], depth = 0) {
  if (depth > 8 || output.join("\n").length > 24000 || value == null) return output;
  if (typeof value === "string") {
    const text = value
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|li|h[1-6])\s*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 2) output.push(text);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectNhsText(item, output, depth + 1));
    return output;
  }
  if (typeof value === "object") {
    ["name", "description", "healthAspect", "text", "hasPart", "mainEntityOfPage"].forEach((key) => {
      if (key in value) collectNhsText(value[key], output, depth + 1);
    });
  }
  return output;
}

async function getNhsMedicineGrounding(client, messages) {
  if (!process.env.NHS_API_KEY) return null;
  const recentText = messages
    .slice(-4)
    .map((message) => `${message.role}: ${String(message.content || "")}`)
    .join("\n")
    .slice(0, 6000);
  if (!recentText) return null;

  const classification = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Identify the single medicine the user is asking about. Return JSON only as " +
          "{\"medicine\": string|null, \"slug\": string|null}. The slug must be the lowercase NHS.uk generic " +
          "medicine name with words joined by hyphens. Do not infer a medicine if none is named or unambiguously present in context.",
      },
      { role: "user", content: recentText },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(classification.choices?.[0]?.message?.content || "{}");
  } catch {
    return null;
  }
  const path = normaliseNhsContentPath(`medicines/${parsed.slug || ""}`);
  if (!parsed.medicine || !path || path === "medicines/") return null;

  const { baseUrl, environment } = getNhsContentBaseUrl();
  const url = new URL(path, baseUrl);
  url.searchParams.set("modules", "true");
  const upstream = await fetch(url, {
    headers: { Accept: "application/json", apikey: process.env.NHS_API_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!upstream.ok) {
    console.warn("No NHS medicine grounding found:", upstream.status, { path, environment });
    return null;
  }
  const content = await upstream.json();
  const sourceUrl = typeof content?.url === "string" ? content.url : null;
  const logoUrl = typeof content?.author?.logo === "string" ? content.author.logo : null;
  const text = [...new Set(collectNhsText(content))].join("\n").slice(0, 24000);
  return text ? { medicine: parsed.medicine, sourceUrl, logoUrl, text } : null;
}

/* =======================================================================================
 * NHS Website Content API v2
 * ======================================================================================= */
exports.nhsContent = onRequest({ secrets: ["NHS_API_KEY"] }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

      const user = await requireFirebaseUser(req);
      if (!user) return res.status(401).json({ error: "unauthorized" });

      const path = normaliseNhsContentPath(req.query.path);
      if (!path) return res.status(400).json({ error: "invalid_nhs_content_path" });

      const { baseUrl, environment } = getNhsContentBaseUrl();
      const url = new URL(path, baseUrl);
      for (const [key, value] of Object.entries(req.query)) {
        if (key === "path" || key.toLowerCase() === "apikey") continue;
        const values = Array.isArray(value) ? value : [value];
        values.forEach((item) => url.searchParams.append(key, String(item)));
      }

      const headers = { Accept: "application/json" };
      if (environment !== "sandbox") {
        if (!process.env.NHS_API_KEY) throw new Error("NHS_API_KEY is not configured");
        headers.apikey = process.env.NHS_API_KEY;
      }

      const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        console.error("NHS Content API error:", upstream.status, { path, environment });
        return res.status(upstream.status).json({ error: "nhs_content_error" });
      }

      res.set("Cache-Control", "private, max-age=300");
      return res.status(200).json(body);
    } catch (err) {
      console.error("NHS Content API request failed:", err);
      const status = err?.code?.startsWith("auth/") ? 401 : 502;
      return res.status(status).json({ error: "nhs_content_unavailable" });
    }
  });
});

/* =======================================================================================
 * Chat (unchanged)
 * ======================================================================================= */
exports.chat = onRequest({ secrets: ["OPENAI_API_KEY", "NHS_API_KEY"] }, (req, res) => {
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

      // 🧹 Keep only recent context
      const MAX_CONTEXT = 10;
      const trimmed = messages.slice(-MAX_CONTEXT).map((message) => ({
        role: message?.role,
        content: String(message?.content || ""),
      }));

      // Create OpenAI client with v2 secret
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let nhsGrounding = null;
      try {
        nhsGrounding = await getNhsMedicineGrounding(client, trimmed);
      } catch (error) {
        console.warn("NHS grounding unavailable; continuing safely:", error?.message || error);
      }

      const system = {
        role: "system",
        content:
          "You are PharmAI, a friendly UK pharmacist assistant. Be concise and clear. " +
          "For medicine facts, use only the NHS WEBSITE CONTENT supplied below in this prompt. " +
          "Label every factual statement supported by it as [NHS]. Never claim to have checked EMC or BNF because they are not supplied. " +
          "If the supplied NHS content does not answer the question, clearly say you cannot confirm it from the available NHS content and advise checking the patient leaflet or a pharmacist. " +
          "Do not invent side effects, doses, interactions, contraindications, frequencies, or urgency advice. " +
          "Never diagnose or replace medical advice. Recommend 999/A&E only when the supplied NHS content supports emergency action; otherwise suggest NHS 111, a pharmacist, or a doctor as appropriate. " +
          "Include a Sources section with the supplied NHS.uk source URL when one is available. " +
          "Use short plain-language sections and bullets without markdown heading or bold syntax. Keep a reassuring, non-judgmental tone.\n\n" +
          (nhsGrounding
            ? `NHS WEBSITE CONTENT FOR ${nhsGrounding.medicine}\nSource: ${nhsGrounding.sourceUrl || "NHS.uk"}\n${nhsGrounding.text}`
            : "NHS WEBSITE CONTENT: No matching NHS medicine page was retrieved for this conversation."),
      };

      // 🧾 Call OpenAI
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [system, ...trimmed],
      });

      const reply =
        resp.choices?.[0]?.message?.content ||
        "Sorry, I couldn't generate a response.";
      const nhsAttribution = nhsGrounding?.sourceUrl
        ? {
            sourceUrl: nhsGrounding.sourceUrl,
            logoUrl: nhsGrounding.logoUrl || null,
            label: "Information supplied by the NHS website",
          }
        : null;

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
        { role: "assistant", content: reply, ...(nhsAttribution ? { nhsAttribution } : {}) },
      ];

      toSave.forEach((m) => {
        const docRef = msgsCol.doc();
        batch.set(docRef, { ...m, createdAt: now });
      });

      await batch.commit();

      return res.json({ reply, chatId: createdId, nhsAttribution });
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
 * PharmAI internal administration
 * ======================================================================================= */
async function requireAdmin(req) {
  const decoded = await requireFirebaseUser(req);
  return decoded?.admin === true ? decoded : null;
}

async function countAuthUsers() {
  let pageToken;
  let count = 0;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    count += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
}

exports.adminMetrics = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
      const actor = await requireAdmin(req);
      if (!actor) return res.status(403).json({ error: "admin_required" });

      const [users, organisations, requests, openSupport] = await Promise.all([
        countAuthUsers(),
        db.collection("pharmacyOrganisations").count().get(),
        db.collection("pharmacyRequests").count().get(),
        db.collection("supportThreads").where("status", "in", ["open", "waiting_partner"]).count().get(),
      ]);

      await db.collection("auditEvents").add({
        action: "admin.metrics.viewed",
        actorUid: actor.uid,
        actorEmail: actor.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        users,
        pharmacyOrganisations: organisations.data().count,
        pharmacyRequests: requests.data().count,
        openSupport: openSupport.data().count,
      });
    } catch (error) {
      console.error("adminMetrics failed:", error);
      return res.status(500).json({ error: "admin_metrics_failed" });
    }
  });
});

exports.adminProvisionPortal = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
      const actor = await requireAdmin(req);
      if (!actor) return res.status(403).json({ error: "admin_required" });
      const { action } = req.body || {};

      if (action === "create_organisation") {
        const name = String(req.body?.name || "").trim().slice(0, 120);
        const primaryContactEmail = String(req.body?.primaryContactEmail || "").trim().toLowerCase().slice(0, 254);
        if (!name || !primaryContactEmail.includes("@")) return res.status(400).json({ error: "invalid_organisation" });
        const orgRef = db.collection("pharmacyOrganisations").doc();
        await orgRef.set({ name, primaryContactEmail, status: "onboarding", branchCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: actor.uid });
        await db.collection("auditEvents").add({ action: "pharmacy.organisation_created", actorUid: actor.uid,
          actorEmail: actor.email || null, pharmacyOrgId: orgRef.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ ok: true, organisationId: orgRef.id });
      }

      if (action === "add_member") {
        const organisationId = String(req.body?.organisationId || "");
        const email = String(req.body?.email || "").trim().toLowerCase();
        const role = String(req.body?.role || "pharmacy_staff");
        if (!["org_admin", "branch_manager", "pharmacist", "pharmacy_staff", "support"].includes(role)) {
          return res.status(400).json({ error: "invalid_role" });
        }
        const orgRef = db.collection("pharmacyOrganisations").doc(organisationId);
        if (!(await orgRef.get()).exists) return res.status(404).json({ error: "organisation_not_found" });
        const user = await admin.auth().getUserByEmail(email);
        await orgRef.collection("members").doc(user.uid).set({ uid: user.uid, email,
          displayName: user.displayName || email, role, active: true,
          branchIds: Array.isArray(req.body?.branchIds) ? req.body.branchIds.slice(0, 50) : [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: actor.uid }, { merge: true });
        await db.collection("auditEvents").add({ action: "pharmacy.member_added", actorUid: actor.uid,
          actorEmail: actor.email || null, pharmacyOrgId: organisationId, subjectUid: user.uid, role,
          createdAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ ok: true, uid: user.uid });
      }
      return res.status(400).json({ error: "unsupported_action" });
    } catch (error) {
      console.error("adminProvisionPortal failed:", error);
      const status = error?.code === "auth/user-not-found" ? 404 : 500;
      return res.status(status).json({ error: status === 404 ? "user_not_found" : "provisioning_failed" });
    }
  });
});

async function requirePharmacyMember(uid, organisationId) {
  if (!uid || !organisationId) return null;
  const membership = await db.collection("pharmacyOrganisations").doc(organisationId)
    .collection("members").doc(uid).get();
  return membership.exists && membership.data()?.active === true ? membership.data() : null;
}

exports.pharmacyPortalAction = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
      const actor = await requireFirebaseUser(req);
      if (!actor) return res.status(401).json({ error: "unauthorized" });
      const organisationId = String(req.body?.organisationId || "");
      const member = await requirePharmacyMember(actor.uid, organisationId);
      if (!member) return res.status(403).json({ error: "pharmacy_membership_required" });

      if (req.body?.action === "update_request_status") {
        const allowed = ["accepted", "ready_later", "need_more_info", "out_of_stock", "completed", "rejected"];
        const status = String(req.body?.status || "");
        if (!allowed.includes(status)) return res.status(400).json({ error: "invalid_status" });
        const requestRef = db.collection("pharmacyRequests").doc(String(req.body?.requestId || ""));
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(requestRef);
          if (!snapshot.exists || snapshot.data()?.pharmacyOrgId !== organisationId) throw new Error("request_not_found");
          const history = Array.isArray(snapshot.data()?.statusHistory) ? snapshot.data().statusHistory.slice(-99) : [];
          transaction.update(requestRef, { status, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPharmacyActionAt: admin.firestore.FieldValue.serverTimestamp(),
            statusHistory: [...history, { status, actorUid: actor.uid, at: new Date().toISOString() }] });
          transaction.set(db.collection("auditEvents").doc(), { action: "pharmacy.request_status_updated",
            actorUid: actor.uid, actorEmail: actor.email || null, pharmacyOrgId: organisationId,
            resourceType: "pharmacyRequest", resourceId: requestRef.id, status,
            createdAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        return res.json({ ok: true });
      }

      if (req.body?.action === "record_pickup") {
        const shareRef = db.collection("pharmacyPatientShares").doc(String(req.body?.shareId || ""));
        let pickupId;
        await db.runTransaction(async (transaction) => {
          const share = await transaction.get(shareRef);
          const data = share.data();
          const expiresAt = data?.expiresAt?.toDate?.();
          if (!share.exists || data?.active !== true || data?.pharmacyOrgId !== organisationId
            || !Array.isArray(data?.scopes) || !data.scopes.includes("pickup_confirmation")
            || (expiresAt && expiresAt.getTime() <= Date.now())) throw new Error("active_pickup_consent_required");
          const pickupRef = db.collection("prescriptionPickupEvents").doc();
          pickupId = pickupRef.id;
          transaction.set(pickupRef, { patientUid: data.patientUid, pharmacyOrgId: organisationId,
            branchId: data.branchId || null, shareId: share.id, medicationName: data.medicationName || null,
            source: "pharmacy_portal", pickedUpAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: actor.uid });
          transaction.set(db.collection("auditEvents").doc(), { action: "prescription.pickup_recorded",
            actorUid: actor.uid, actorEmail: actor.email || null, pharmacyOrgId: organisationId,
            resourceType: "prescriptionPickupEvent", resourceId: pickupRef.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        return res.json({ ok: true, pickupId });
      }
      return res.status(400).json({ error: "unsupported_action" });
    } catch (error) {
      console.error("pharmacyPortalAction failed:", error);
      const known = ["request_not_found", "active_pickup_consent_required"];
      const message = String(error?.message || "");
      return res.status(known.includes(message) ? 409 : 500).json({ error: known.includes(message) ? message : "portal_action_failed" });
    }
  });
});

exports.syncPharmacyPatientShare = onDocumentWritten(
  "patientPharmacyConsents/{consentId}",
  async (event) => {
    const consent = event.data?.after?.exists ? event.data.after.data() : null;
    const consentId = event.params.consentId;
    const shareRef = db.collection("pharmacyPatientShares").doc(consentId);
    if (!consent?.active) {
      await shareRef.set({ active: false, revokedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    const scopes = Array.isArray(consent.scopes) ? consent.scopes : [];
    const patientUid = consent.patientUid;
    const medicationId = consent.medicationId;
    if (!patientUid || !consent.pharmacyOrgId) return;

    const [patientDoc, medicationDoc] = await Promise.all([
      db.collection("users").doc(patientUid).get(),
      medicationId
        ? db.collection("users").doc(patientUid).collection("reminders").doc(medicationId).get()
        : Promise.resolve(null),
    ]);
    const patient = patientDoc.data() || {};
    const medication = medicationDoc?.exists ? medicationDoc.data() : null;

    let adherenceSummary = null;
    if (scopes.includes("adherence_summary") && medication) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const history = (Array.isArray(medication.history) ? medication.history : []).filter((row) => {
        const date = new Date(`${row?.date}T00:00:00`);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      });
      const doses = history.flatMap((row) => Array.isArray(row?.taken) ? row.taken : []);
      const taken = doses.filter(Boolean).length;
      adherenceSummary = {
        windowDays: 30,
        scheduledDoses: doses.length,
        takenDoses: taken,
        percentage: doses.length ? Math.round((taken / doses.length) * 100) : null,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    await shareRef.set({
      consentId,
      active: true,
      patientUid,
      patientDisplayName: patient.displayName || patient.name || "Patient",
      pharmacyOrgId: consent.pharmacyOrgId,
      branchId: consent.branchId || null,
      medicationId: medicationId || null,
      medicationName: scopes.includes("medicine_identity") ? medication?.name || null : null,
      scopes,
      adherenceSummary,
      expiresAt: consent.expiresAt || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);

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
