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