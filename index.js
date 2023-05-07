const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const conversationCollection = client
      .db("chatApp")
      .collection("conversation");
    const messageCollection = client.db("chatApp").collection("message");
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
              res.status(200).json({
                user: { email: user.email, fullName: user.fullName },
              });
            });
          });
        }
      }
    });
    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).send("Please fill all required fields");
      } else {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          res.status(400).send("User email or password is incorrect");
        } else {
          const validateUser = await bcrypt.compare(password, user.password);
          if (!validateUser) {
            res.status(400).send("User email or password is incorrect");
          } else {
            const payload = {
              userId: user._id,
              email: user.email,
            };
            const JWT_SECRET_KEY =
              process.env.JWT_SECRET_KEY || "THIS_IS_A_JWT_SECRET_KEY";
            jwt.sign(
              payload,
              JWT_SECRET_KEY,
              { expiresIn: 84600 * 30 },
              async (err, token) => {
                const updatedResult = await usersCollection.updateOne(
                  { _id: new ObjectId(user._id) },
                  {
                    $set: { token },
                  }
                );
                res.status(200).json({
                  user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                  },
                  token: token,
                });
              }
            );
          }
        }
      }
    });
    app.post("/api/conversation", async (req, res) => {
      const { senderId, receiverId } = req.body;
      const newConversation = { members: [senderId, receiverId] };
      const result = await conversationCollection.insertOne(newConversation);
      res.send(result);
    });
    app.get("/api/conversations/:userId", async (req, res) => {
      const userId = req.params.userId;
      const conversations = await conversationCollection
        .find({
          members: { $in: [userId] },
        })
        .toArray();
      const conversationUserData = Promise.all(
        conversations.map(async (conversation) => {
          const receiverId = conversation.members.find(
            (member) => member !== userId
          );
          const user = await usersCollection.findOne({
            _id: new ObjectId(receiverId),
          });
          return {
            user: {
              receiverId: user._id,
              email: user.email,
              fullName: user.fullName,
            },
            conversationId: conversation._id,
          };
        })
      );
      res.status(200).json(await conversationUserData);
    });
    app.post("/api/message", async (req, res) => {
      const { conversationId, senderId, message, receiverId } = req.body;
      if (!senderId || !message || !receiverId)
        return res.status(400).send("Please fill all required fields");
      if (conversationId === "new") {
        const newConversation = { members: [senderId, receiverId] };
        const conversation = await conversationCollection.insertOne(
          newConversation
        );
        const newMessage = {
          conversationId: conversation.insertedId.toString(),
          senderId,
          message,
        };
        const result = await messageCollection.insertOne(newMessage);
        return res.status(200).send("Message sent successfully");
      }
      const newMessage = { conversationId, senderId, message };
      const result = await messageCollection.insertOne(newMessage);
      res.status(200).send(result);
    });
    app.get("/api/message/:conversationId", async (req, res) => {
      const checkMessages = async (conversationId) => {
        const messages = await messageCollection
          .find({ conversationId })
          .toArray();
        const messageUserData = Promise.all(
          messages.map(async (message) => {
            const user = await usersCollection.findOne({
              _id: new ObjectId(message.senderId),
            });
            return {
              user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
              },
              message: message.message,
            };
          })
        );
        res.status(200).json(await messageUserData);
      };
      const conversationId = req.params.conversationId;
      if (conversationId === "new") {
        const checkConversation = await conversationCollection
          .find({
            members: {
              $all: [req.query.senderId, req.query.receiverId],
              $size: 2,
            },
          })
          .toArray();
        console.log("checkConversation = ", checkConversation);
        if (checkConversation.length > 0) {
          checkMessages(checkConversation[0]._id.toString());
        } else {
          return res.status(200).send([]);
        }
      } else {
        checkMessages(conversationId);
      }
    });
    app.get("/api/users/:userId", async (req, res) => {
      const userId = req.params.userId;
      const users = await usersCollection
        .find({ _id: { $ne: userId } })
        .toArray();
      const usersData = Promise.all(
        users.map(async (user) => {
          return {
            user: {
              fullName: user.fullName,
              email: user.email,
              receiverId: user._id,
            },
          };
        })
      );
      res.status(200).send(await usersData);
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
