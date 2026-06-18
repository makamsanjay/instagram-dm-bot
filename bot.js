// ============================================================
// Instagram DM Automation Bot
// Triggers welcome message when someone sends you a first DM
// OR when you get a new follower (via follow webhook if available)
// ============================================================

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG — edit your messages here
// ─────────────────────────────────────────
const CONFIG = {
  VERIFY_TOKEN: "my_secret_verify_token_123",
  PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN,
  IG_USER_ID: process.env.IG_USER_ID,
  WELCOME_MESSAGE: "Hey! 👋 Thanks so much for following! I've got something special for you 🎉",
  BUTTON_TITLE: "🎁 Claim Your Free Gift",
  BUTTON_PAYLOAD: "CLAIM_GIFT",
  RESPONSE_MESSAGE: "Here's your exclusive link! 🔥\n\nhttps://your-link-here.com\n\nEnjoy! 💪",
};

// Track who we already welcomed (avoids duplicate messages)
const welcomed = new Set();

// ─────────────────────────────────────────
// WEBHOOK VERIFICATION
// ─────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─────────────────────────────────────────
// MAIN WEBHOOK — handles all events
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // always respond fast
  const body = req.body;
  console.log("📩 Webhook received:", JSON.stringify(body, null, 2));

  for (const entry of body.entry || []) {

    // ── MESSAGING EVENTS (DMs, button clicks) ──
    for (const msg of entry.messaging || []) {
      const senderId = msg.sender?.id;
      if (!senderId || senderId === CONFIG.IG_USER_ID) continue;

      // Button clicked
      if (msg.postback?.payload === CONFIG.BUTTON_PAYLOAD) {
        console.log(`🖱️ Button clicked by ${senderId}`);
        await sendTextMessage(senderId, CONFIG.RESPONSE_MESSAGE);
        continue;
      }

      // First time this person messaged → send welcome
      if (msg.message && !welcomed.has(senderId)) {
        console.log(`📲 First message from ${senderId} — sending welcome`);
        await sendWelcomeMessage(senderId);
        welcomed.add(senderId);
      }
    }

    // ── CHANGES (follow events, comments, etc.) ──
    for (const change of entry.changes || []) {
      console.log(`🔄 Change event: ${change.field}`, change.value);

      // Follow event (if Meta sends it)
      if (change.field === "follow" || 
          (change.field === "follows" && change.value?.verb === "add")) {
        const followerId = change.value?.user_id || change.value?.sender_id;
        if (followerId && !welcomed.has(followerId)) {
          console.log(`📲 New follower: ${followerId}`);
          await sendWelcomeMessage(followerId);
          welcomed.add(followerId);
        }
      }
    }
  }
});

// ─────────────────────────────────────────
// SEND WELCOME MESSAGE WITH BUTTON
// ─────────────────────────────────────────
async function sendWelcomeMessage(recipientId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: CONFIG.WELCOME_MESSAGE,
              buttons: [{
                type: "postback",
                title: CONFIG.BUTTON_TITLE,
                payload: CONFIG.BUTTON_PAYLOAD,
              }],
            },
          },
        },
      },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ Welcome DM sent to ${recipientId}`);
  } catch (err) {
    console.error(`❌ Failed DM to ${recipientId}:`, err.response?.data || err.message);
  }
}

// ─────────────────────────────────────────
// SEND PLAIN TEXT MESSAGE
// ─────────────────────────────────────────
async function sendTextMessage(recipientId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/me/messages`,
      { recipient: { id: recipientId }, message: { text } },
      { params: { access_token: CONFIG.PAGE_ACCESS_TOKEN } }
    );
    console.log(`✅ Text sent to ${recipientId}`);
  } catch (err) {
    console.error(`❌ Failed text to ${recipientId}:`, err.response?.data || err.message);
  }
}

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/", (req, res) => res.send("🤖 Instagram DM Bot is running!"));

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});
