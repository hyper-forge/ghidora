import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))

export default {
  port: 4000, // 👈 change port here
  fetch: app.fetch,
}