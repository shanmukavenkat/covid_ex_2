const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('The server is running at http://localhost:3000')
    })
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }
}

initializeDbAndServer()

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'snvskomal', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

// Function to convert snake_case to camelCase
const camelCase = snakeCase => {
  const camelCaseObj = {}

  for (const key in snakeCase) {
    const camelCaseKey = key
      .split('_')
      .map((word, index) =>
        index === 0 ? word : word[0].toUpperCase() + word.slice(1),
      )
      .join('')

    camelCaseObj[camelCaseKey] = snakeCase[key]
  }

  return camelCaseObj
}

// API to handle login
app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `SELECT * 
    FROM 
    user
    WHERE 
    username = 
    '${username}';`

  const dbResponse = await db.get(selectUserQuery)
  if (dbResponse === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCheck = await bcrypt.compare(password, dbResponse.password)
    if (isPasswordCheck === true) {
      const payload = {username: username}

      const jwtToken = jwt.sign(payload, 'snvskomal')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password') // Corrected to match the expected response
    }
  }
})

// API to get the list of all states
app.get('/states/', authentication, async (request, response) => {
  const selectUserQuery = `SELECT * 
  FROM 
  state;`

  const dbUser = await db.all(selectUserQuery)
  const theData = dbUser.map(camelCase)
  response.send(theData)
})

// API to get details of a specific state by ID
app.get('/states/:stateId', authentication, async (request, response) => {
  const {stateId} = request.params
  const selectUserQuery = `SELECT 
  * 
  FROM 
  state
  WHERE 
  state_id = ${stateId};`

  const dbUser = await db.get(selectUserQuery)
  const theData = camelCase(dbUser)
  response.send(theData)
})

// API to create a new district
app.post('/districts/', authentication, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const insertDistrictQuery = `
    INSERT INTO 
      district (district_name, state_id, cases, cured, active, deaths) 
    VALUES 
      ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`

  await db.run(insertDistrictQuery)
  response.send('District Successfully Added')
})

// API to get details of a specific district by ID
app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params

    const selectUserQuery = `SELECT * 
  FROM 
  district
  WHERE 
  district_id = ${districtId};`

    const dbUser = await db.get(selectUserQuery)
    response.send(camelCase(dbUser))
  },
)

// API to delete a district by ID
app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
    DELETE FROM
    district
   WHERE 
   district_id = ${districtId};`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

// API to update a district by ID
app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrictQuery = `
    UPDATE 
      district 
    SET 
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE 
      district_id = ${districtId};`

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// API to get statistics of a specific state
app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params

    const getStateStatsQuery = `
    SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};
  `

    const stats = await db.get(getStateStatsQuery)
    response.send(camelCase(stats))
  },
)

module.exports = app
