import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(Error(`${path.basename(command)} failed: ${code}`)))
  })
}

await fs.mkdir(path.join(root, 'assets'), { recursive: true })
const logo = await fs.readFile(path.join(root, 'frontend/public/ravenai.png'))
const png = await sharp(logo).resize(256, 256).png().toBuffer()
await fs.writeFile(path.join(root, 'assets/icon.png'), png)
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
await fs.writeFile(path.join(root, 'assets/icon.ico'), Buffer.concat([header, png]))
await run(process.execPath, ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'], path.join(root, 'frontend'))
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.desktop.config.ts'], path.join(root, 'frontend'))
console.log('Built Ravenai desktop renderer and Windows icons.')
