'use strict'

const { net } = require('electron')

function responseHeaders(values) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(values)) {
    if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) continue
    for (const entry of Array.isArray(value) ? value : [value]) headers.append(name, entry)
  }
  return headers
}

// Return redirects to Chromium so OAuth changes the actual page origin and retains cookies.
function forwardRequest(session, request) {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(request.headers.entries())
    for (const name of ['host', 'connection', 'content-length']) delete headers[name]
    const client = net.request({
      url: request.url, method: request.method, session, headers,
      bypassCustomProtocolHandlers: true, redirect: 'manual', useSessionCookies: true,
    })
    let settled = false
    client.on('error', (error) => { if (!settled) reject(error) })
    client.on('redirect', (status, _method, destination, values) => {
      settled = true
      const headers = responseHeaders(values)
      headers.set('location', destination)
      resolve(new Response(null, { status, headers }))
    })
    client.on('response', (response) => {
      settled = true
      const headers = responseHeaders(response.headers)
      const empty = request.method === 'HEAD' || [204, 205, 304].includes(response.statusCode)
      if (empty) {
        response.on('data', () => {})
        resolve(new Response(null, { status: response.statusCode, headers }))
        return
      }
      let finished = false
      const body = new ReadableStream({
        start(controller) {
          response.on('data', chunk => { if (!finished) controller.enqueue(new Uint8Array(chunk)) })
          response.on('end', () => { if (!finished) { finished = true; controller.close() } })
          response.on('error', error => { if (!finished) { finished = true; controller.error(error) } })
        },
        cancel() { finished = true; client.abort() },
      })
      resolve(new Response(body, { status: response.statusCode, headers }))
    })
    request.signal.addEventListener('abort', () => client.abort(), { once: true })
    ;(async () => {
      if (request.body) {
        const reader = request.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          client.write(Buffer.from(value))
        }
      }
      client.end()
    })().catch(reject)
  })
}

module.exports = { forwardRequest }
