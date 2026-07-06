#!/usr/bin/env tsx
import { createServer } from 'node:http'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { API_URL } from './api.js'
import { buildServer } from './server.js'

const useHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http'

async function mainStdio() {
  const server = buildServer()
  await server.connect(new StdioServerTransport())
  console.error(`🎙️  MCP piges-radio (stdio) — API : ${API_URL}`)
}

/** Transport HTTP streamable, sans état : un couple serveur/transport par requête. */
async function mainHttp() {
  const port = Number(process.env.PORT ?? 3003)

  const httpServer = createServer(async (req, res) => {
    if (req.url?.split('?')[0] === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }))
      return
    }
    if (req.url?.split('?')[0] !== '/mcp') {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Utilisez POST /mcp' }))
      return
    }
    if (req.method !== 'POST') {
      // Mode sans état : pas de flux SSE serveur ni de session à clore
      res
        .writeHead(405, { 'content-type': 'application/json', allow: 'POST' })
        .end(JSON.stringify({ error: 'Méthode non autorisée (serveur MCP sans état : POST uniquement)' }))
      return
    }

    try {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined

      const server = buildServer()
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (e) {
      console.error('MCP HTTP error', e)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Erreur interne du serveur MCP' },
            id: null
          })
        )
      }
    }
  })

  httpServer.listen(port, () => {
    console.log(`🎙️  MCP piges-radio (HTTP) sur :${port}/mcp — API : ${API_URL}`)
  })
}

;(useHttp ? mainHttp() : mainStdio()).catch((e) => {
  console.error('Fatal', e)
  process.exit(1)
})
