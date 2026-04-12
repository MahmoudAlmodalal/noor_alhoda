import { execFileSync } from "node:child_process";
import path from "node:path";

const backendDir = path.resolve(__dirname, "../../../backend");

export function seedE2E(options?: { otpCode?: string }) {
  const args = ["manage.py", "seed_e2e", "--quiet"];

  if (options?.otpCode) {
    args.push("--otp-code", options.otpCode);
  }

  execFileSync("python3", args, {
    cwd: backendDir,
    stdio: "ignore",
  });
}
