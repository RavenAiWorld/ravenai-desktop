'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { validateStore } = require('./policy.cjs')

function createVault(directory, encryption) {
  const file = path.join(directory, 'account.vault')
  let queue = Promise.resolve()
  let state = {}
  let initialized = false
  async function read() {
    await queue
    if (initialized) return { ...state }
    if (!await encryption.isAsyncEncryptionAvailable()) throw Error('Secure storage unavailable')
    try {
      const result = await encryption.decryptStringAsync(await fs.readFile(file))
      state = validateStore(JSON.parse(result.result))
    } catch (error) {
      if (error.code !== 'ENOENT') throw Error('Secure storage could not be opened')
    }
    initialized = true
    return { ...state }
  }
  function write(data) {
    const next = validateStore(data)
    const operation = queue.then(async () => {
      const encrypted = await encryption.encryptStringAsync(JSON.stringify(next))
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(file + '.tmp', encrypted, { mode: 0o600 })
      await fs.rename(file + '.tmp', file)
      state = next
    })
    queue = operation.catch(() => {})
    return operation
  }
  return { read, write, flush: () => queue }
}

module.exports = { createVault }
