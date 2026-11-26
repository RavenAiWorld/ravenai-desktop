import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import electron from 'electron'
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'qa-output')
await fs.mkdir(output, { recursive: true })
const data = await fs.mkdtemp(path.join(output, 'session-'))
const env = { ...process.env, RAVEN_QA: '1', RAVEN_QA_DATA: data, RAVEN_QA_OUTPUT: output }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.'], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env,
})
child.on('exit', code => { process.exitCode = code ?? 1 })
