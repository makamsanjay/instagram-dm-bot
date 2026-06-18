// ============================================================
// Instagram DM Automation Bot - Polling Method
// Checks for new followers every 2 minutes and sends DM
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
  POLL_INTERVAL_MS: 2 * 60 * 1000, // every 2 minutes
  WELCOME_MESSAGE: "Hey! 👋 Thanks so much for following! I've got something special for you 🎉",
  BUTTON_TITLE: "🎁 Claim Your Free Gift",
  BUTTON_PAYLOAD: "CLAIM_GIFT",
  RESPONSE_MESSAGE: "Here's your exclusive link! 🔥\n\nhttps://your-link-here.com\n\nEnjoy! 💪",
};

// ─────────────────────────────────────────
// STORAGE — tracks who already got a DM
// ─────────────────────────────────────────
const sentTo = new Set();
let isFirstRun = true;

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
// BUTTON CLICK HANDLER (postback)
// ─────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const body = req.body;
  res.sendStatus(200);

  for (const entry of body.entry || []) {
    const messaging = entry.messaging || [];
    for (const msg of messaging) {
      if (msg.postback?.payload === CONFIG.BUTTON_PAYLOAD) {
        const senderId = msg.sender?.id;
        if (senderId) {
          console.log(`🖱️ Button clicked by ${senderId}`);
          await sendTextMessage(senderId, CONFIG.RESPONSE_MESSAGE);
        }
      }
    }
  }
});

// ─────────────────────────────────────────
// POLL FOR NEW FOLLOWERS
// ─────────────────────────────────────────
async function checkNewFollowers() {
  try {
    const url = `https://graph.instagram.com/v21.0/${CONFIG.IG_USER_ID}/followers`;
    const res = await axios.get(url, {
      params: {
        fields: "id,username",
        access_token: CONFIG.PAGE_ACCESS_TOKEN,
        limit: 50,
      },
    });

    const followers = res.data?.data || [];

    if (isFirstRun) {
      // On first run, just load existing followers — don't DM them
      followers.forEach((f) => sentTo.add(f.id));
      isFirstRun = false;
      console.log(`📋 Loaded ${followers.length} existing followers (no DMs sent)`);
      return;
    }

    for (const follower of followers) {
      if (!sentTo.has(follower.id)) {
        console.log(`📲 New follower: ${follower.username} (${follower.id})`);
        await sendWelcomeMessage(follower.id);
        sentTo.add(follower.id);
      }
    }
  } catch (err) {
    console.error("❌ Error checking followers:", err.response?.data || err.message);
  }
}

// ─────────────────────────────────────────
// SEND WELCOME MESSAGE WITH BUTTON
// ─────────────────────────────────────────
async function sendWelcomeMessage(recipientId) {
  const url = `https://graph.facebook.com/v21.0/me/messages`;
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
    await axios.post(url, payload, {
      params: { access_token: CONFIG.PAGE_ACCESS_TOKEN },
    });
    console.log(`✅ Welcome DM sent to ${recipientId}`);
  } catch (err) {
    console.error(`❌ Failed to DM ${recipientId}:`, err.response?.data || err.message);
  }
}

// ─────────────────────────────────────────
// SEND PLAIN TEXT MESSAGE
// ─────────────────────────────────────────
async function sendTextMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v21.0/me/messages`;
  try {
    await axios.post(url, {
      recipient: { id: recipientId },
      message: { text },
    }, {
      params: { access_token: CONFIG.PAGE_ACCESS_TOKEN },
    });
    console.log(`✅ Text message sent to ${recipientId}`);
  } catch (err) {
    console.error(`❌ Failed to send text to ${recipientId}:`, err.response?.data || err.message);
  }
}

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("🤖 Instagram DM Bot is running!");
});

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
  // Start polling immediately, then every 2 minutes
  checkNewFollowers();
  setInterval(checkNewFollowers, CONFIG.POLL_INTERVAL_MS);
});
