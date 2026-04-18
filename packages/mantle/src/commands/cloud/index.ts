import { defineCommand } from "citty";
import { hub } from "./hub.ts";
import { login } from "./login.ts";
import { logout } from "./logout.ts";
import { whoami } from "./whoami.ts";

export const cloud = defineCommand({
  meta: { name: "cloud", description: "Mantle Cloud" },
  subCommands: {
    login,
    logout,
    whoami,
    hub,
  },
});
