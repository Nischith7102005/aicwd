const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://neondb_owner:npg_JW06qdtpwmYh@ep-plain-water-aisvxre7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function runMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Neon Postgres');

    const sql = fs.readFileSync(path.join(__dirname, 'red_team_schema.sql'), 'utf8');
    
    // Split SQL by semicolon and run each statement, but wait, 
    // plpgsql functions have semicolons inside.
    // Better to run the whole block or use a better parser.
    // pg client can handle multiple statements in one query if they are simple, 
    // but here we have functions. Actually, pg client can run the whole file.
    
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
