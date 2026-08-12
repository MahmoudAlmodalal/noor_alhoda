export const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";

export const seededUsers = {
  admin: {
    phone: "0599100001",
    password: "0001",
  },
  teacher: {
    phone: "0599100010",
    password: "0010",
  },
  student: {
    phone: "0599100020",
    password: "0020",
  },
  parent: {
    phone: "0599100030",
    password: "0030",
  },
} as const;

export const seededIds = {
  teacher: "11111111-1111-4111-8111-111111111111",
  teacherTwo: "22222222-2222-4222-8222-222222222222",
  student: "33333333-3333-4333-8333-333333333333",
  studentTwo: "44444444-4444-4444-8444-444444444444",
  unassignedStudent: "55555555-5555-4555-8555-555555555555",
} as const;

export const knownOtp = "246810";
