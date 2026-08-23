import fs from 'node:fs';
import { parse } from 'dotenv';

function databaseName(databaseUrl) {
  try {
    const pathname = new URL(databaseUrl).pathname.replace(/^\/+/, '');
    return pathname.split('/').pop() || '';
  } catch {
    return '';
  }
}

export function resolveTestEnvironment({ fileValues = {}, filePresent = false, processEnv = {} } = {}) {
  const databaseUrl = filePresent
    ? fileValues.DATABASE_URL
    : processEnv.NODE_ENV === 'test' ? processEnv.DATABASE_URL : undefined;

  if (!databaseUrl) {
    throw new Error('Tests require DATABASE_URL from backend/.env.test or an explicitly injected NODE_ENV=test environment.');
  }

  if (!/_test$/i.test(databaseName(databaseUrl))) {
    throw new Error('Tests require a dedicated database whose name ends with _test.');
  }

  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    EMAIL_HOST: '',
    EMAIL_PORT: '',
    EMAIL_USER: '',
    EMAIL_PASSWORD: '',
  };
}

export function loadTestEnvironment({ envFilePath, processEnv = process.env } = {}) {
  const filePresent = Boolean(envFilePath && fs.existsSync(envFilePath));
  const fileValues = filePresent ? parse(fs.readFileSync(envFilePath)) : {};
  return resolveTestEnvironment({ fileValues, filePresent, processEnv });
}

export default { loadTestEnvironment, resolveTestEnvironment };
