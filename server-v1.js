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
const TOKEN_VALIDITY = process.env.TOKEN_VALIDITY || 24 * 60 * 60;

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
    const userId = req.body.userId || uuidv4(); // Generate unique ID if not provided
    const { role, name, image, callId, custom } = req.body;

    if (!role) {
      return res
        .status(400)
        .send({ message: "Role is required (viewer or broadcaster)." });
    }

    if (!allowedCallIds.includes(callId)) {
      return res.status(400).send({ message: "Invalid call ID." });
    }

    const newUser = {
      id: userId,
      role, // Could be "viewer" or "broadcaster"
      custom,
      name,
      image,
    };

    // Validate broadcaster specifics
    if (role === "broadcaster" && !name) {
      return res
        .status(400)
        .send({ message: "Name is required for broadcasters." });
    }

    // Upsert user into Stream
    await client.upsertUsers([newUser]);

    // Generate token
    const token = client.generateCallToken({
      user_id: userId,
      call_cids: [callId],
      role, // Assign role based on the request
      validity_in_seconds: TOKEN_VALIDITY,
    });

    console.log(`User (${role}) created with token:`, { userId, token });
    res.status(200).send({ userId, token });
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
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
