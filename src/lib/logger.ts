import pino from 'pino'

const isClient = typeof window !== 'undefined'

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(isClient
    ? {
        browser: {
          asObject: true,
          serialize: true,
        },
      }
    : process.env.NODE_ENV !== 'production'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
})

export type { Logger } from 'pino'

export default logger
