require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { StreamClient } = require("@stream-io/node-sdk");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const APIKEY = process.env.APIKEY;
const SECRET_KEY = process.env.SECRET_KEY;
const TOKEN_VALIDITY = parseInt(process.env.TOKEN_VALIDITY) || 24 * 60 * 60;

// Validate environment variables
if (!APIKEY || !SECRET_KEY) {
  console.error("APIKEY and SECRET_KEY are required environment variables");
  process.exit(1);
}

// Simulated allowed call IDs
const allowedCallIds = ["livestream_17475406-dedb-46db-b14b-854dd9254ee9"];

// Create a StreamClient instance
const client = new StreamClient(APIKEY, SECRET_KEY);

async function createUser(req, res) {
  try {
    const { role, name, image, callId, custom } = req.body;

    if (!role) {
      return res
        .status(400)
        .send({ message: "Role is required (user or broadcaster)." });
    }

    if (!callId || !allowedCallIds.includes(callId)) {
      return res.status(400).send({ message: "Invalid or missing call ID." });
    }

    // Automatically set userId to "!anon" for anonymous users
    const userId =
      role === "user" && !req.body.userId
        ? "!anon"
        : req.body.userId || uuidv4();

    // Log anonymous user processing
    if (userId === "!anon") {
      console.log("Processing anonymous user.");
    } else {
      console.log(`Processing regular user: ${userId}`);
    }

    // Initialize the new user object
    const newUser = {
      id: userId,
      role,
      custom,
      name,
      image,
    };

    // Broadcaster-specific validation
    if (role === "broadcaster") {
      if (!name) {
        return res
          .status(400)
          .send({ message: "Name is required for broadcasters." });
      }
      console.log(`Processing broadcaster: ${name}`);
    }

    // Upsert user into Stream (excluding anonymous users)
    if (userId !== "!anon") {
      await client.upsertUsers([newUser]);
    }

    // Generate token
    const token = client.generateCallToken({
      user_id: userId,
      call_cids: [callId],
      role, // Assign role based on the request
      validity_in_seconds: TOKEN_VALIDITY,
    });

    console.log(`User (${role}) created with token:`, { userId, token });

    // Include callId in the response
    res.status(200).send({ userId, token, callId });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .send({ message: "Error creating user", error: error.message });
  }
}

// Define API routes
app.post("/api/createUser", createUser);

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
