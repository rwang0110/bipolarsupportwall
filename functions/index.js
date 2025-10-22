// functions/index.js
const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

exports.analyzeSentiment = functions.https.onCall(async (data, context) => {
  const { content } = data;

  if (!content || typeof content !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Content required");
  }

  if (content.length < 10 || content.length > 1000) {
    throw new functions.https.HttpsError("invalid-argument", "Content must be 10-1000 characters");
  }

  try {
    console.log("Analyzing with Hugging Face...");

    const response = await axios.post(
        "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
        { inputs: content },
        {
          headers: {
            "Authorization": `Bearer ${functions.config().huggingface.key}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
    );

    const sentimentResults = response.data[0];
    const negativeSentiment = sentimentResults.find((s) => s.label === "NEGATIVE");
    const positiveSentiment = sentimentResults.find((s) => s.label === "POSITIVE");

    const isStronglyNegative = negativeSentiment && negativeSentiment.score > 0.75;

    const lowerContent = content.toLowerCase();

    // Block harmful content
    const harmfulKeywords = [
      "kill yourself", "kys", "end it all", "commit suicide",
      "you should die", "worthless piece", "everyone hates you",
      "nobody cares about you", "better off dead",
    ];

    const hasHarmfulContent = harmfulKeywords.some((k) => lowerContent.includes(k));

    // Block spam
    const spamKeywords = ["buy now", "click here", "limited offer", "make money fast"];
    const isSpam = spamKeywords.some((k) => lowerContent.includes(k));

    // Allow support-seeking (even if negative)
    const supportiveContext = [
      "struggling", "having a hard time", "feeling down", "need help",
      "dark thoughts", "tough day", "need support", "anyone else",
    ];

    const isSeekingSupport = supportiveContext.some((p) => lowerContent.includes(p));

    let approved = true;
    let reason = "Message appears appropriate";

    if (hasHarmfulContent) {
      approved = false;
      reason = "Message contains harmful or abusive language";
    } else if (isSpam) {
      approved = false;
      reason = "Message appears to be spam";
    } else if (isStronglyNegative && !isSeekingSupport) {
      approved = false;
      reason = "Message appears overly negative. Please frame your message supportively.";
    } else if (isSeekingSupport) {
      approved = true;
      reason = "Message is seeking support";
    }

    console.log("Decision:", approved ? "APPROVED" : "BLOCKED");

    return {
      approved: approved,
      reason: reason,
      sentiment: {
        negative: negativeSentiment?.score || 0,
        positive: positiveSentiment?.score || 0,
      },
    };
  } catch (error) {
    console.error("Analysis error:", error.message);

    // Fallback: block only critical harmful keywords
    const lowerContent = content.toLowerCase();
    const criticalKeywords = ["kill yourself", "kys", "commit suicide"];

    if (criticalKeywords.some((k) => lowerContent.includes(k))) {
      return { approved: false, reason: "Inappropriate content" };
    }

    // Otherwise allow (fail open)
    return { approved: true, reason: "Analysis unavailable - allowed by default" };
  }
});
