// Fails when a server secret reaches the browser bundle (spec 1E §5): the
// Supabase secret key prefix always, and the key itself when it is given.
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

const CLIENT_DIR = "dist/client"
const needles = [{ label: 'the "sb_secret_" prefix', value: "sb_secret_" }]
if (process.env.SUPABASE_SECRET_KEY) {
  needles.push({
    label: "the value of SUPABASE_SECRET_KEY",
    value: process.env.SUPABASE_SECRET_KEY,
  })
}

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? filesIn(path) : [path]
    })
  )
  return nested.flat()
}

const leaks = []
for (const path of await filesIn(CLIENT_DIR)) {
  const text = (await readFile(path)).toString("latin1")
  for (const needle of needles) {
    if (text.includes(needle.value)) leaks.push(`${path}: ${needle.label}`)
  }
}

if (leaks.length > 0) {
  console.error(`Server secrets in the browser bundle:\n${leaks.join("\n")}`)
  process.exit(1)
}
console.log(`No server secrets in ${CLIENT_DIR}.`)
