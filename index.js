const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
require("dotenv").config();
const bcrypt = require("bcryptjs");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const uri = process.env.DB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    const usersCollection = client.db("chatApp").collection("users");
    app.post("/api/register", async (req, res) => {
      const user = req.body;
      const { fullName, email, password } = user;
      if (!fullName || !email || !password) {
        res.status(400).send("Please fill all required fields");
      } else {
        const isAlreadyExist = await usersCollection.findOne({ email });
        if (isAlreadyExist) {
          res.status(400).send("User already exists");
        } else {
          const newUser = { fullName, email };
          bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(password, salt, async (err, hash) => {
              newUser.password = hash;
              const result = await usersCollection.insertOne(newUser);
              res.send(result);
            });
          });
        }
      }
    });
  } finally {
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Chat server running");
});

app.listen(port, () => {
  console.log(`chat server is running on port ${port}`);
});
