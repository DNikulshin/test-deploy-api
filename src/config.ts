import * as dotenv from 'dotenv';
dotenv.config();

export const config = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtResetSecret: process.env.JWT_RESET_SECRET,
  clientUrl: process.env.FRONTEND_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  mail: {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
  },
});

export type Config = ReturnType<typeof config>;
