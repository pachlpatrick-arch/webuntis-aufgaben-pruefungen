const fs = require("fs");
const crypto = require("crypto");
const { WebUntis } = require("webuntis");

const CONFIG = {
  server:
    process.env.WEBUNTIS_SERVER ||
    "elgym.webuntis.com",

  school:
    process.env.WEBUNTIS_SCHOOL ||
    "elgym",

  username:
    process.env.WEBUNTIS_USERNAME,

  password:
    process.env.WEBUNTIS_PASSWORD,

  daysPast:
    Number(process.env.DAYS_PAST || 30),

  daysFuture:
    Number(process.env.DAYS_FUTURE || 180),

  outputFile:
    process.env.OUTPUT_FILE ||
    "aufgaben-pruefungen.ics",

  calendarName:
    process.env.CALENDAR_NAME ||
    "WebUntis Aufgaben und Prüfungen",

  timezone:
    "Europe/Vienna"
};

function required(name, value) {
  if (!value) {
    throw new Error(
      `Die Umgebungsvariable ${name} fehlt.`
    );
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function addDays(date, days) {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function parseUntisDate(value) {
  const text = String(value || "");

  if (!/^\d{8}$/.test(text)) {
    throw new Error(
      `Ungültiges WebUntis-Datum: ${value}`
    );
  }

  return {
    year: Number(text.slice(0, 4)),
    month: Number(text.slice(4, 6)),
    day: Number(text.slice(6, 8))
  };
}

function icalDate(value) {
  const date = parseUntisDate(value);

  return (
    `${date.year}` +
    `${pad(date.month)}` +
    `${pad(date.day)}`
  );
}

function nextIcalDate(value) {
  const parts = parseUntisDate(value);

  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day
  );

  date.setDate(
    date.getDate() + 1
  );

  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}`
  );
}

function displayDate(value) {
  const date = parseUntisDate(value);

  return (
    `${pad(date.day)}.` +
    `${pad(date.month)}.` +
    `${date.year}`
  );
}

function icalDateTime(
  dateValue,
  timeValue
) {
  const time = String(
    timeValue || 0
  ).padStart(4, "0");

  return (
    `${icalDate(dateValue)}T` +
    `${time.slice(0, 2)}` +
    `${time.slice(2, 4)}00`
  );
}

function utcStamp(
  date = new Date()
) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcal(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function foldLine(line) {
  if (
    Buffer.byteLength(
      line,
      "utf8"
    ) <= 73
  ) {
    return line;
  }

  const result = [];

  let current = "";
  let length = 0;

  for (const character of line) {
    const size =
      Buffer.byteLength(
        character,
        "utf8"
      );

    if (length + size > 73) {
      result.push(current);

      current =
        ` ${character}`;

      length =
        1 + size;
    } else {
      current += character;
      length += size;
    }
  }

  if (current) {
    result.push(current);
  }

  return result.join("\r\n");
}

function createUid(type, item) {
  const source = [
    CONFIG.school,
    type,
    item.id || "",
    item.date ||
      item.examDate ||
      "",
    item.dueDate || "",
    item.startTime || "",
    item.endTime || ""
  ].join("-");

  const hash = crypto
    .createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 32);

  return (
    `${hash}@webuntis-ical`
  );
}

function firstText(...values) {
  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }

    if (
      value &&
      typeof value === "object"
    ) {
      const text =
        value.name ||
        value.longname ||
        value.displayName ||
        value.shortName;

      if (
        typeof text === "string" &&
        text.trim()
      ) {
        return text.trim();
      }
    }
  }

  return "";
}

function normalizeHomeworkData(
  value
) {
  if (Array.isArray(value)) {
    return {
      homeworks: value,
      lessons: []
    };
  }

  const homeworks =
    value?.homeWorks ||
    value?.homeworks ||
    value?.data?.homeWorks ||
    value?.data?.homeworks ||
    [];

  const lessons =
    value?.lessons ||
    value?.data?.lessons ||
    [];

  return {
    homeworks:
      Array.isArray(homeworks)
        ? homeworks
        : [],

    lessons:
      Array.isArray(lessons)
        ? lessons
        : []
  };
}

function matchingLesson(
  homework,
  lessons
) {
  return lessons.find(
    (lesson) =>
      Number(lesson?.id) ===
        Number(
          homework?.lessonId
        ) ||
      Number(
        lesson?.lessonId
      ) ===
        Number(
          homework?.lessonId
        ) ||
      Number(
        lesson?.lsnumber
      ) ===
        Number(
          homework?.lessonId
        )
  );
}

function homeworkSubject(
  homework,
  lessons
) {
  const lesson =
    matchingLesson(
      homework,
      lessons
    );

  return (
    firstText(
      homework.subject,
      homework.subjectName,
      homework.subjectLongName,
      homework.su?.[0],
      homework.subjects?.[0],
      lesson?.subject,
      lesson?.subjectName,
      lesson?.subjectLongName,
      lesson?.su?.[0],
      lesson?.subjects?.[0]
    ) ||
    "Hausaufgabe"
  );
}
function homeworkEvent(
  homework,
  lessons,
  stamp
) {
  const subject =
    homeworkSubject(
      homework,
      lessons
    );

  const dueDateText =
    homework.dueDate
      ? displayDate(
          homework.dueDate
        )
      : "ohne Fälligkeitsdatum";

  const description = [
    homework.text
      ? `Hausaufgabe: ${homework.text}`
      : "Hausaufgabe",

    homework.remark
      ? `Anmerkung: ${homework.remark}`
      : null,

    homework.dueDate
      ? `Fällig am: ${dueDateText}`
      : null,

    homework.completed === true
      ? "Status: Erledigt"
      : "Status: Offen"
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VEVENT",

    `UID:${createUid(
      "homework",
      homework
    )}`,

    `DTSTAMP:${stamp}`,

    `DTSTART;VALUE=DATE:` +
      `${icalDate(
        homework.date
      )}`,

    `DTEND;VALUE=DATE:` +
      `${nextIcalDate(
        homework.date
      )}`,

    `SUMMARY:${escapeIcal(
      `HÜ: ${subject} - ${dueDateText}`
    )}`,

    `DESCRIPTION:${escapeIcal(
      description
    )}`,

    "TRANSP:TRANSPARENT",
    "STATUS:CONFIRMED",
    "END:VEVENT"
  ];

  return lines
    .map(foldLine)
    .join("\r\n");
}

function examEvent(exam, stamp) {
  const examType =
    firstText(
      exam.examType,
      exam.type,
      exam.name
    ) ||
    "Prüfung";

  const subject =
    firstText(
      exam.subject,
      exam.subjectName,
      exam.su?.[0],
      exam.name
    ) ||
    "Prüfung";

  const description = [
    exam.text
      ? `Information: ${exam.text}`
      : null,

    exam.name &&
    exam.name !== subject
      ? `Bezeichnung: ${exam.name}`
      : null,

    Array.isArray(
      exam.teachers
    ) &&
    exam.teachers.length > 0
      ? `Lehrkraft: ${exam.teachers.join(
          ", "
        )}`
      : null,

    Array.isArray(
      exam.rooms
    ) &&
    exam.rooms.length > 0
      ? `Raum: ${exam.rooms.join(
          ", "
        )}`
      : null
  ]
    .filter(Boolean)
    .join("\n");

  let dateLines;

  if (
    Number(exam.startTime) > 0 &&
    Number(exam.endTime) > 0
  ) {
    dateLines = [
      `DTSTART;TZID=${CONFIG.timezone}:` +
        `${icalDateTime(
          exam.examDate,
          exam.startTime
        )}`,

      `DTEND;TZID=${CONFIG.timezone}:` +
        `${icalDateTime(
          exam.examDate,
          exam.endTime
        )}`
    ];
  } else {
    dateLines = [
      `DTSTART;VALUE=DATE:` +
        `${icalDate(
          exam.examDate
        )}`,

      `DTEND;VALUE=DATE:` +
        `${nextIcalDate(
          exam.examDate
        )}`
    ];
  }

  const lines = [
    "BEGIN:VEVENT",

    `UID:${createUid(
      "exam",
      exam
    )}`,

    `DTSTAMP:${stamp}`,

    ...dateLines,

    `SUMMARY:${escapeIcal(
      `${examType}: ${subject}`
    )}`,

    `DESCRIPTION:${escapeIcal(
      description
    )}`,

    "STATUS:CONFIRMED",
    "END:VEVENT"
  ];

  return lines
    .map(foldLine)
    .join("\r\n");
}
function createCalendar(events) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",

    "PRODID:-//WebUntis Aufgaben und Pruefungen//DE",

    `X-WR-CALNAME:${escapeIcal(
      CONFIG.calendarName
    )}`,

    `X-WR-TIMEZONE:${CONFIG.timezone}`,

    "REFRESH-INTERVAL;VALUE=DURATION:PT5H",
    "X-PUBLISHED-TTL:PT5H",

    "BEGIN:VTIMEZONE",

    `TZID:${CONFIG.timezone}`,

    "X-LIC-LOCATION:Europe/Vienna",

    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",

    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",

    "END:DAYLIGHT",

    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",

    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",

    "END:STANDARD",

    "END:VTIMEZONE",

    ...events,

    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

async function getHomeworkAndLessons(
  untis,
  startDate,
  endDate
) {
  try {
    const combined =
      await untis.getHomeWorkAndLessons(
        startDate,
        endDate
      );

    const normalized =
      normalizeHomeworkData(
        combined
      );

    if (
      normalized.homeworks.length > 0
    ) {
      return normalized;
    }
  } catch (error) {
    console.log(
      "Kombinierter Hausaufgabenabruf nicht verfügbar. Verwende Fallback."
    );
  }

  const [
    homeworks,
    timetable
  ] = await Promise.all([
    untis.getHomeWorksFor(
      startDate,
      endDate
    ),

    untis.getOwnTimetableForRange(
      startDate,
      endDate
    )
  ]);

  return {
    homeworks:
      Array.isArray(homeworks)
        ? homeworks
        : [],

    lessons:
      Array.isArray(timetable)
        ? timetable
        : []
  };
}
async function main() {
  required(
    "WEBUNTIS_USERNAME",
    CONFIG.username
  );

  required(
    "WEBUNTIS_PASSWORD",
    CONFIG.password
  );

  console.log(
    `WebUntis-Server: ${CONFIG.server}`
  );

  console.log(
    `Schulkennung: ${CONFIG.school}`
  );

  console.log(
    `Ausgabedatei: ${CONFIG.outputFile}`
  );

  const untis = new WebUntis(
    CONFIG.school,
    CONFIG.username,
    CONFIG.password,
    CONFIG.server,
    "GitHub-WebUntis-Aufgaben-Pruefungen"
  );

  const startDate = addDays(
    new Date(),
    -CONFIG.daysPast
  );

  const endDate = addDays(
    new Date(),
    CONFIG.daysFuture
  );

  try {
    await untis.login();

    console.log(
      "WebUntis-Anmeldung erfolgreich."
    );

    const [
      homeworkData,
      exams
    ] = await Promise.all([
      getHomeworkAndLessons(
        untis,
        startDate,
        endDate
      ),

      untis.getExamsForRange(
        startDate,
        endDate
      )
    ]);
