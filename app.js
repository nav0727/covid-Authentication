const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let database = null;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

// convert state  DB..Obj... Resp..Obj
const convertStateDbObjToResObj = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

//convert districts dbObj to resObj

const convertDistDbObjToResObj = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};

//authentication Redundant Code reusable

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "nav0727", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// to jwtToken API and also check user in DBList or not

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      let jwtToken = jwt.sign(payload, "nav0727");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get ALL states API

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state; `;
  const statesArray = await database.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertStateDbObjToResObj(eachState))
  );
});

// get single state  api

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getSingleQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const states = await database.get(getSingleQuery);
  response.send(convertStateDbObjToResObj(states));
});

//Post district  api

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  const distr = await database.run(postQuery);
  response.send("District Successfully Added");
});

//get single district

app.get(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSingleDistQuery = `SELECT * FROM district WHERE district_id=${districtId} ;`;
    const dist = await database.get(getSingleDistQuery);
    response.send(convertDistDbObjToResObj(dist));
  }
);

//delete dist API

app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const delSingleDistQuery = `DELETE  FROM district WHERE district_id=${districtId} ;`;
    const distr = await database.run(delSingleDistQuery);
    response.send("District Removed");
  }
);

//PUT   district  API

app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistQuery = `UPDATE district SET  district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId} ;`;
    await database.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//stateWise status API

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getTotalQuery = `SELECT SUM(cases) AS totalCases,
                                    SUM(cured) AS totalCured,
                                    SUM(active) AS totalActive ,
                                    SUM(deaths) AS totalDeaths
                     FROM  state NATURAL JOIN  district  WHERE state_id=${stateId};`;

    const totalSum = await database.get(getTotalQuery);
    response.send(totalSum);
  }
);
//get stateName API

app.get(
  "/districts/:districtId/details/",
  authenticationToken,
  async (request, response) => {
    const { stateName } = request.body;
    const { districtId } = request.params;

    const getNameQuery = `SELECT state_name 
                     FROM state  NATURAL JOIN  district WHERE district_id=${districtId};`;

    const stateNam = await database.get(getNameQuery);
    response.send(convertStateDbObjToResObj(stateNam));
  }
);

module.exports = app;
