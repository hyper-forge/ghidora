import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))

export default {
  port: 4800, // 👈 change port here
  fetch: app.fetch,
}