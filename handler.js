const { google } = require('googleapis')
const dotenv = require('dotenv')
dotenv.config({ path: './.env' })

const timeZone = 'Europe/Helsinki'

const requiredEnvVars = ['SHEET_ID', 'SHEET_RANGE', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'REQUEST_TIME_PROPERTY_NAME']
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
})

const oAuth2Client = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
})

const sheets = google.sheets({ version: 'v4', auth: oAuth2Client })

function extractLevel(obj, path) {
  const target = path ? getNestedProperty(obj, path) : obj
  return target && typeof target === 'object'
    ? Object.entries(target).map(([key, value]) => [key, value])
    : []
}

function getNestedProperty(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function convertUTCtoFinnishTime(utcTime) {
  const date = new Date(utcTime)

  const options = { timeZone: 'Europe/Helsinki', hour12: false }
  const finnishFormatter = new Intl.DateTimeFormat('fi-FI', {
    ...options,
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })

  const formattedDate = finnishFormatter.format(date)
  const [weekday, day, month, year, oclock, hour, minute, second] = formattedDate
    .replace(/[^\d\s\w]/g, ' ')
    .split(' ')

  const dayOfWeekNumber = (date.getUTCDay() + 6) % 7 + 1

  const finnishDate = `${day}.${month}.${year} ${oclock} ${hour}.${minute}.${second}`
  const weekdayBaseName = weekday.slice(0, -2)

  const numericHour = +hour
  const numericMinute = +minute

  return {
    dayOfWeekNumber,
    hour: numericHour,
    minute: numericMinute,
    finnishDate,
    weekdayBaseName
  }
}

module.exports.appendToSheet = async event => {
  try {
    const body = JSON.parse(event.body)
    const timePropertyName = process.env.REQUEST_TIME_PROPERTY_NAME // e.g., "timestamp" or "payload_fields.timestamp"

    // Dynamically resolve the time property
    const time = getNestedProperty(body, timePropertyName)

    if (!time) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `The ${timePropertyName} field is required in the request body.` })
      }
    }

    // Convert UTC time to Finnish time
    const finnishTime = convertUTCtoFinnishTime(time)

    // Parse multiple nested paths from the environment variable
    const nestedPaths = (process.env.REQUEST_PAYLOAD_NESTED_PATH || '').split(',').map(path => path.trim())

    // Extract data from all specified nested paths
    const nestedData = nestedPaths.flatMap(path => extractLevel(body, path))

    // Collect top-level remaining data (excluding time and nested paths)
    const remainingData = Object.entries(body)
      .filter(([key]) => key !== timePropertyName.split('.')[0] && !nestedPaths.some(path => path.split('.')[0] === key))
      .map(([, value]) => value)

    // Combine all extracted data
    const additionalData = nestedData.map(([, value]) => value)

    // Prepare row data
    const rowData = [
      time,
      finnishTime.dayOfWeekNumber,
      finnishTime.hour,
      finnishTime.minute,
      finnishTime.finnishDate,
      finnishTime.weekdayBaseName,
      ...additionalData,
      ...remainingData
    ]

    // Append the data to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: process.env.SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [rowData] }
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Data appended to Google Sheet successfully.', data: rowData })
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to append data to Google Sheet.', error })
    }
  }
}