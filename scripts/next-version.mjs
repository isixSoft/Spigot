/**
 * 算出下一个版本号,打到 stdout(形如 v1.0.1)。
 *
 * 为什么要它:版本号由 tag 决定,不是由仓库里 package.json 那个值决定。
 * 手动填 tag=auto 时,在上一个正式 Release 基础上补丁 +1。
 *
 * 只看正式 Release —— /releases/latest 本来就跳过 prerelease,
 * 所以那些 dev-N 开发构建不会把版本号顶上去。
 *
 * 上一个 tag 解析不了时报错停下,不退回 v1.0.0。
 * 静默退回会去发一个早就发过的版本号。
 */

const REPO =
  process.env.GITHUB_REPOSITORY ?? 'isixSoft/Spigot'

async function latestTag() {
  const token = process.env.GITHUB_TOKEN
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers },
  )
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`releases/latest HTTP ${res.status}`)
  }
  const body = await res.json()
  return body.tag_name ?? null
}

function bumpPatch(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim())
  if (!m) {
    console.error(`上一个 tag 看不懂: ${tag}`)
    process.exit(1)
  }
  return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`
}

const tag = await latestTag()
const next = tag ? bumpPatch(tag) : 'v1.0.0'
process.stdout.write(next)
