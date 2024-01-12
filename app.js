const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "./twitterClone.db");

let db;

const initializeTheDbAndServer = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  app.listen(3000, () => {
    console.log("Server running at port: http://localhost:3000");
  });
};

initializeTheDbAndServer();

// Register APT-1

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const userExistQuery = `
    SELECT * 
    FROM user
    WHERE username = '${username}'
  `;
  const userExist = await db.get(userExistQuery);

  if (userExist === undefined) {
    if (password.length < 6) {
      response.send(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUser = `
        INSERT INTO user (
            username,
            password,
            name,
            gender
        )
        VALUES (
            '${username}',
            '${hashedPassword}',
            '${name}',
            '${gender}'
        );
        `;

      await db.run(createUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// Login API-2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT * 
    FROM user
    WHERE username = '${username}'
  `;

  const isValidUser = await db.get(getUserQuery);

  if (isValidUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isValidPassword = bcrypt.compare(password, isValidUser.password);
    if (isValidPassword) {
      const payload = { username, user_id: isValidUser.user_id };
      const jwtToken = jwt.sign(payload, "naveenkrish24");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// jwtAuthentication Middleware Function

const jwtAuthentication = (request, response, next) => {
  const authHeader = request.headers.authorization;
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken) {
    jwt.verify(jwtToken, "naveenkrish24", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.user_id;
        next();
      }
    });
  } else {
    response.send(401);
    response.send("Invalid JWT Token");
  }
};

// API-3

const getFollowingPeoples = async (username) => {
  const getFollowingPeoplesQuery = `
    SELECT * 
    FROM user
        INNER JOIN follower
        ON user.user_id = follower.follower_user_id
    WHERE user.username = '${username}'
  `;
  const followingPeoples = await db.all(getFollowingPeoplesQuery);
  const arrayOfFollowingPeoplesIds = followingPeoples.map(
    (eachUser) => eachUser.following_user_id
  );

  return arrayOfFollowingPeoplesIds;
};

app.get("/user/tweets/feed", jwtAuthentication, async (request, response) => {
  const { username } = request;

  const followingPeoples = await getFollowingPeoples(username);

  const getTweetsQuery = `
    SELECT user.username AS username,
    tweet.tweet AS tweet,
    tweet.date_time AS DateTime
    FROM user 
        INNER JOIN tweet
        ON user.user_id = tweet.user_id
    WHERE user.user_id IN (${followingPeoples})
    ORDER BY DateTime DESC
    LIMIT 4;
  `;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

// API-4

app.get("/user/following", jwtAuthentication, async (request, response) => {
  const { username, userId } = request;
  console.log(username);
  console.log(userId);

  const followingPeoples = await getFollowingPeoples(username);
  const followersSqlQuery = `
        SELECT user.username AS username
        FROM user
            INNER JOIN follower
            ON user.user_id = follower.follower_user_id
        WHERE user.user_id IN (${followingPeoples});
    `;
  const followers = await db.all(followersSqlQuery);
  response.send(followers);
});
