// ============================================================
// Instagram DM Automation Bot
// Sends a welcome DM with a button when someone follows you
// ============================================================

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────
// CONFIG — fill these in before running
// ─────────────────────────────────────────
const CONFIG = {
  VERIFY_TOKEN: "my_secret_verify_token_123", // Any string you choose
  PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN, // From Meta Developer Dashboard
  BUTTON_TITLE: "🎁 Claim Your Free Gift", // Text shown on the button
  WELCOME_MESSAGE: "Hey! 👋 Thanks so much for following! I've got something special for you 🎉", // First message
  BUTTON_PAYLOAD: "CLAIM_GIFT", // Internal identifier (don't change)
  RESPONSE_MESSAGE: "Here's your exclusive link! 🔥\n\nhttps://your-link-here.com\n\nEnjoy! 💪", // Sent when button is clicked
};

// ─────────────────────────────────────────
// WEBHOOK VERIFICATION (Meta checks this once)
// ─────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ─────────────────────────────────────────
// MAIN WEBHOOK — receives all events
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      // ── NEW FOLLOWER ──
      if (
        change.field === "follow" &&
        change.value?.item === "follow" &&
        change.value?.verb === "add"
      ) {
        const followerId = change.value.user_id?.toString();
        if (followerId) {
          console.log(`📲 New follower: ${followerId}`);
          await sendWelcomeMessage(followerId);
        }
      }

      // ── BUTTON CLICK (postback) ──
      if (change.field === "messages") {
        const msg = change.value;
        const postback = msg?.postback;
        const senderId = msg?.sender?.id;

        if (postback?.payload === CONFIG.BUTTON_PAYLOAD && senderId) {
          console.log(`🖱️  Button clicked by: ${senderId}`);
          await sendLinkMessage(senderId);
        }
      }
    }
  }

  res.sendStatus(200);
});

// ─────────────────────────────────────────
// SEND WELCOME MESSAGE WITH BUTTON
// ─────────────────────────────────────────
async function sendWelcomeMessage(recipientId) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${CONFIG.PAGE_ACCESS_TOKEN}`;

  const payload = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: CONFIG.WELCOME_MESSAGE,
          buttons: [
            {
              type: "postback",
              title: CONFIG.BUTTON_TITLE,
              payload: CONFIG.BUTTON_PAYLOAD,
            },
          ],
        },
      },
    },
  };

  try {
    const res = await axios.post(url, payload);
    console.log(`✅ Welcome message sent to ${recipientId}`);
  } catch (err) {
    console.error(
      `❌ Failed to send welcome to ${recipientId}:`,
      err.response?.data || err.message
    );
  }
}

// ─────────────────────────────────────────
// SEND LINK MESSAGE AFTER BUTTON CLICK
// ─────────────────────────────────────────
async function sendLinkMessage(recipientId) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${CONFIG.PAGE_ACCESS_TOKEN}`;

  const payload = {
    recipient: { id: recipientId },
    message: {
      text: CONFIG.RESPONSE_MESSAGE,
    },
  };

  try {
    await axios.post(url, payload);
    console.log(`✅ Link message sent to ${recipientId}`);
  } catch (err) {
    console.error(
      `❌ Failed to send link to ${recipientId}:`,
      err.response?.data || err.message
    );
  }
}

// ─────────────────────────────────────────
// HEALTH CHECK (for hosting platforms)
// ─────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🤖 Instagram DM Bot is running!");
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://your-domain.com/webhook`);
});
