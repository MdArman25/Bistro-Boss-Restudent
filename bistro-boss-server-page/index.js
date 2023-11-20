const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const SSLCommerzPayment = require('sslcommerz-lts')
const port = process.env.PORT || 5000;
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

// console.log(process.env.USER,process.env.PASS);
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const store_id =process.env.STORE_SECRET_ID
const store_passwd =process.env.STORE_SECRET_API
const is_live = false //true for live, false for sandbox


const { MongoClient, ServerApiVersion, ObjectId, Admin } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.ninjyyh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("token in the middleware", token);
  // no token available
  if (!token) {
    // console.log("token");
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    // console.log();
    next();
  });
};
// const verifyAdmin =  (req, res, next) => {
//   const email = req?.user?.email;
// console.log(email);
//   const query = { email: email };
//   const user =  UserCollection.findOne(query);
//   const isAdmin = user?.role === "admin";
//   if (!isAdmin) {
//     return res.status(403).send({ message: "forbidden access" });
//   }
//   next();
// };

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const MenuCollection = client.db("Bistro-Boss").collection("Menus");
    const UserCollection = client.db("Bistro-Boss").collection("Users");
    const cartsCollection = client.db("Bistro-Boss").collection("carts");
    const ReviewsCollection = client.db("Bistro-Boss").collection("Reviews");
    const paymentsCollection = client.db("Bistro-Boss").collection("payments");

    // midleWare
    // const varifyToken = (req,res,next)=>{
    //   console.log(req.headers)
    //   next()
    // }
    //     const verifyToken = (req, res, next) => {
    //       const token = req?.cookies?.token;
    // console.log('token',token);
    //       if (!token) {
    //         console.log('cheak');
    //         return res.status(401).send({ message: "unauthorized access" });
    //       }
    //       jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    //         if (err) {
    //           console.log(err);
    //           return res.status(401).send({ message: "unauthorized access" });
    //         }
    //         req.user = decoded;
    //         console.log("user",req.user);
    //         next();
    //       });
    //     };

    app.get("/menus", async (req, res) => {
      const result = await MenuCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });
    app.get("/menus/:id", async (req, res) => {
      const id = req.params.id;
      // const query = { _id: new ObjectId(id) }
      const result = await MenuCollection.findOne({ _id: id });
      res.send(result);
    });
    app.patch("/menus/:id", async (req, res) => {
      const id = req.params.id;
      const item = req.body;

      const filter = { _id: id };
      const updateDoct = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await MenuCollection.updateOne(filter, updateDoct);
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await ReviewsCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });
    app.get("/Carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    app.get("/Users", verifyToken, async (req, res) => {
      console.log("cheack to token", req.user.email);
      // console.log(req.user);
      const result = await UserCollection.find().toArray();
      // console.log(result);
      res.send(result);
    });

    app.get("/admin/:email", verifyToken, async (req, res) => {
      console.log(req?.user?.email);
      const email = req.params.email;

      //  console.log(req?.user,"emaillllllll",email);
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "unauthorized Access" });
      }
      const query = { email: email };
      const user = await UserCollection.findOne(query);
      console.log("admin request user", user.role);
      let isAdmin = false;
      if (user.role === "admin") {
        // isAdmin = user?.role=='admin'
        isAdmin = true;
        console.log(isAdmin, "sadhdiowh");
        res.send({ isAdmin });
      }
    });
    app.post("/menu", verifyToken, async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await MenuCollection.insertOne(item);
      res.send(result);
    });
    // logut
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });
    // cart collection
    app.post("/Addcart", async (req, res) => {
      const cartitem = req.body;
      // console.log(cartitem);
      const result = await cartsCollection.insertOne(cartitem);
      res.send(result);
    });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // payment related api

    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      console.log(query);
      const deleteResult = await cartsCollection.deleteMany(query);
      console.log("payment info", result, payment, deleteResult);
      res.send({ result, deleteResult });
    });
    app.get("/payment/:email", verifyToken, async (req, res) => {
      console.log(req?.user?.email);
      const email = req?.params.email;

      console.log(req?.user, "emaillllllll", email);
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "unauthorized Access" });
      }
      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
      console.log(result);

      console.log(result);
      res.send(result)
    });

    app.post("/users", async (req, res) => {
      const User = req.body;
      // console.log("auth user", User);
      const query = { email: User.email };
      const Exitinguser = await UserCollection.findOne(query);
      if (Exitinguser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await UserCollection.insertOne(User);
      res.send(result);
    });
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      // console.log("this is token", token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const UpdatedUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await UserCollection.updateOne(query, UpdatedUser);
      console.log(result);

      res.send(result);
    });

    // delete
    app.delete("/Carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await UserCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/menus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await MenuCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  console.log(res.send("BISTRO BOSS SERVER SITE IS RUNNING"));
});
app.listen(port, () => {
  console.log(`server is running on this port ${port}`);
});
